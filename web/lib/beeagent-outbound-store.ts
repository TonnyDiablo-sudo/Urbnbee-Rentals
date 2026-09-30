import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { getMysqlPool } from "@/lib/db";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";
import type { OutboundEventName } from "@/lib/beeagent-outbound-policy";

export type OutboundRowStatus = "pending" | "delivered" | "dead";

export type OutboundWebhookRow = {
  eventId: string;
  event: OutboundEventName;
  hostId: string;
  beeagentCustomerId: number;
  bookingId?: string;
  occurredAt: string;
  payload: unknown;
  status: OutboundRowStatus;
  attempts: number;
  nextAttemptAt: string;
  lastHttp?: number;
  lastError?: string;
  createdAt: string;
  deliveredAt?: string;
};

const DATA_FILE = join(getDataDir(), "outbound-webhooks.json");
const rows = new Map<string, OutboundWebhookRow>();
let cachedMtime = 0;

function persistJson() {
  try {
    ensureDir(getDataDir());
    writeFileSync(DATA_FILE, JSON.stringify({ version: 1, rows: [...rows.values()] }, null, 2), "utf8");
    if (existsSync(DATA_FILE)) cachedMtime = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[outbound-webhooks] persist json:", e);
  }
}

function reloadJson() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { rows?: OutboundWebhookRow[] };
    rows.clear();
    for (const r of data.rows ?? []) {
      if (r?.eventId) rows.set(r.eventId, r);
    }
    cachedMtime = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[outbound-webhooks] load json:", e);
  }
}

function syncJson() {
  try {
    if (!existsSync(DATA_FILE)) return;
    if (statSync(DATA_FILE).mtimeMs === cachedMtime) return;
    reloadJson();
  } catch {
    /* ignore */
  }
}

reloadJson();

function dt(iso: string): Date {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

async function upsertMysql(row: OutboundWebhookRow): Promise<void> {
  const pool = getMysqlPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO urb_outbound_webhooks
       (event_id, event, host_id, beeagent_customer_id, booking_id, occurred_at, payload,
        status, attempts, next_attempt_at, last_http, last_error, created_at, delivered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       attempts = VALUES(attempts),
       next_attempt_at = VALUES(next_attempt_at),
       last_http = VALUES(last_http),
       last_error = VALUES(last_error),
       delivered_at = VALUES(delivered_at)`,
    [
      row.eventId,
      row.event,
      row.hostId,
      row.beeagentCustomerId,
      row.bookingId ?? null,
      dt(row.occurredAt),
      JSON.stringify(row.payload),
      row.status,
      row.attempts,
      dt(row.nextAttemptAt),
      row.lastHttp ?? null,
      row.lastError ?? null,
      dt(row.createdAt),
      row.deliveredAt ? dt(row.deliveredAt) : null,
    ]
  );
}

export function saveOutboundRow(row: OutboundWebhookRow): OutboundWebhookRow {
  syncJson();
  rows.set(row.eventId, row);
  persistJson();
  void upsertMysql(row).catch((e) => console.warn("[outbound-webhooks] mysql upsert:", e));
  return row;
}

export function getOutboundRow(eventId: string): OutboundWebhookRow | undefined {
  syncJson();
  return rows.get(eventId);
}

export async function listDueOutboundRows(now = new Date(), limit = 20): Promise<OutboundWebhookRow[]> {
  const pool = getMysqlPool();
  if (pool) {
    try {
      const [found] = await pool.query(
        `SELECT event_id, event, host_id, beeagent_customer_id, booking_id, occurred_at, payload,
                status, attempts, next_attempt_at, last_http, last_error, created_at, delivered_at
           FROM urb_outbound_webhooks
          WHERE status = 'pending' AND next_attempt_at <= ?
          ORDER BY next_attempt_at ASC
          LIMIT ?`,
        [now, limit]
      );
      if (Array.isArray(found)) {
        return (found as Record<string, unknown>[]).map(mysqlToRow);
      }
    } catch (e) {
      console.warn("[outbound-webhooks] mysql list:", e);
    }
  }
  syncJson();
  const iso = now.toISOString();
  return [...rows.values()]
    .filter((r) => r.status === "pending" && r.nextAttemptAt <= iso)
    .sort((a, b) => a.nextAttemptAt.localeCompare(b.nextAttemptAt))
    .slice(0, limit);
}

function mysqlToRow(r: Record<string, unknown>): OutboundWebhookRow {
  const payload = r.payload;
  return {
    eventId: String(r.event_id),
    event: String(r.event) as OutboundEventName,
    hostId: String(r.host_id),
    beeagentCustomerId: Number(r.beeagent_customer_id),
    bookingId: r.booking_id ? String(r.booking_id) : undefined,
    occurredAt: toIso(r.occurred_at),
    payload: typeof payload === "string" ? JSON.parse(payload) : payload,
    status: String(r.status) as OutboundRowStatus,
    attempts: Number(r.attempts),
    nextAttemptAt: toIso(r.next_attempt_at),
    lastHttp: r.last_http != null ? Number(r.last_http) : undefined,
    lastError: r.last_error ? String(r.last_error) : undefined,
    createdAt: toIso(r.created_at),
    deliveredAt: r.delivered_at ? toIso(r.delivered_at) : undefined,
  };
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return new Date(v).toISOString();
  return new Date().toISOString();
}
