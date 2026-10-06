import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import type { HostInboxMessageRecord } from "@/lib/host-inbox-types";
import { getMysqlPool } from "@/lib/db";
import { scheduleMysql, upsertInboxRow } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "host-inbox-messages.json");

const rows: HostInboxMessageRecord[] = [];
let cachedMtimeMs = 0;

function persist(changed?: HostInboxMessageRecord) {
  try {
    ensureDir(getDataDir());
    writeFileSync(DATA_FILE, JSON.stringify({ version: 1, messages: rows }, null, 2), "utf8");
    if (existsSync(DATA_FILE)) {
      cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    }
    if (changed) scheduleMysql(() => upsertInboxRow(changed));
  } catch (e) {
    console.warn("[host-inbox-store] persist failed:", e);
  }
}

/** Un mensaje puede ser sólo foto o audio, sin texto. */
function isValidRow(m: HostInboxMessageRecord | undefined): m is HostInboxMessageRecord {
  return Boolean(m?.id && m.listingId && m.hostId && m.guestSessionId && m.sender && m.createdAt && (m.body || m.attachment));
}

function reloadFromDisk() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const raw = readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw) as { messages?: HostInboxMessageRecord[] };
    rows.length = 0;
    for (const m of data.messages ?? []) {
      if (isValidRow(m)) rows.push(m);
    }
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[host-inbox-store] load failed:", e);
  }
}

function syncIfStale() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    reloadFromDisk();
  } catch {
    /* ignore */
  }
}

reloadFromDisk();

function id(prefix: string) {
  return `${prefix}_${randomBytes(10).toString("hex")}`;
}

function nowIso() {
  return new Date().toISOString();
}

export function appendMessage(rec: Omit<HostInboxMessageRecord, "id" | "createdAt">): HostInboxMessageRecord {
  syncIfStale();
  const message: HostInboxMessageRecord = {
    ...rec,
    id: id("msg"),
    createdAt: nowIso(),
  };
  rows.push(message);
  persist(message);
  return message;
}

/**
 * Las versiones anteriores descartaban al recargar los mensajes sin texto (fotos/audios);
 * MySQL sí los conserva. Sólo se recuperan en hilos que siguen existiendo.
 */
export async function restoreAttachmentMessagesFromMysql(): Promise<number> {
  const pool = getMysqlPool();
  if (!pool) return 0;
  const [result] = await pool.query(
    "SELECT payload FROM urb_host_inbox_messages WHERE JSON_EXTRACT(payload, '$.attachment') IS NOT NULL",
  );
  syncIfStale();
  const have = new Set(rows.map((m) => m.id));
  const threads = new Set(rows.map((m) => `${m.listingId}:${m.guestSessionId}`));
  let added = 0;
  for (const r of result as { payload: unknown }[]) {
    const m = (typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload) as HostInboxMessageRecord;
    if (!isValidRow(m) || have.has(m.id) || !threads.has(`${m.listingId}:${m.guestSessionId}`)) continue;
    rows.push(m);
    have.add(m.id);
    added++;
  }
  if (added) persist();
  return added;
}

export function listAllMessages(): readonly HostInboxMessageRecord[] {
  syncIfStale();
  return rows;
}

export function listThread(listingId: string, guestSessionId: string): HostInboxMessageRecord[] {
  syncIfStale();
  return rows
    .filter((m) => m.listingId === listingId && m.guestSessionId === guestSessionId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/** Sesión estable para huésped registrado (misma conversación en todos los dispositivos si usa cuenta). */
export function deleteMessagesForAccount(userId: string): void {
  syncIfStale();
  const sid = `gu_${userId}`;
  const next = rows.filter((m) => m.hostId !== userId && m.guestSessionId !== sid);
  if (next.length === rows.length) return;
  rows.length = 0;
  rows.push(...next);
  persist();
}

export function guestSessionIdForUser(userId: string): string {
  return `gu_${userId}`;
}

/** Une hilos si el huésped escribió antes sin cuenta y luego inició sesión. */
export function listThreadMerged(listingId: string, guestSessionIds: string[]): HostInboxMessageRecord[] {
  syncIfStale();
  const allow = new Set(guestSessionIds.filter(Boolean));
  if (allow.size === 0) return [];
  return rows
    .filter((m) => m.listingId === listingId && allow.has(m.guestSessionId))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function listAllThreadsForGuest(userId: string): {
  listingId: string;
  messages: HostInboxMessageRecord[];
  lastAt: string;
}[] {
  syncIfStale();
  const sid = guestSessionIdForUser(userId);
  const byListing = new Map<string, HostInboxMessageRecord[]>();
  for (const m of rows) {
    if (m.guestSessionId !== sid) continue;
    const arr = byListing.get(m.listingId) ?? [];
    arr.push(m);
    byListing.set(m.listingId, arr);
  }
  const out: { listingId: string; messages: HostInboxMessageRecord[]; lastAt: string }[] = [];
  for (const [listingId, msgs] of byListing) {
    msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const lastAt = msgs[msgs.length - 1]?.createdAt ?? "";
    out.push({ listingId, messages: msgs, lastAt });
  }
  out.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  return out;
}

export function listForHost(hostId: string): HostInboxMessageRecord[] {
  syncIfStale();
  return rows
    .filter((m) => m.hostId === hostId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export type InboxThreadKey = `${string}:${string}`;

export function groupThreads(hostId: string): Map<InboxThreadKey, HostInboxMessageRecord[]> {
  syncIfStale();
  const map = new Map<InboxThreadKey, HostInboxMessageRecord[]>();
  for (const m of rows) {
    if (m.hostId !== hostId) continue;
    const key = `${m.listingId}:${m.guestSessionId}` as InboxThreadKey;
    const arr = map.get(key) ?? [];
    arr.push(m);
    map.set(key, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  return map;
}
