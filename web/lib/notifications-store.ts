import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

export type NotificationKind =
  | "message"
  | "request"
  | "booking"
  | "payment"
  | "review"
  | "contract"
  | "verification"
  | "team"
  | "cleaning"
  | "support";

export type NotificationRecord = {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  vars?: Record<string, string | number>;
  rawBody?: boolean;
  /** Ruta dentro de la app que abre la notificación. */
  url: string;
  /** Avisos con la misma llave (p. ej. el mismo hilo de chat) se agrupan: sólo queda el último. */
  groupKey?: string;
  createdAt: string;
  readAt?: string;
};

const DATA_FILE = join(getDataDir(), "notifications.json");
const MAX_PER_USER = 150;
const rows: NotificationRecord[] = [];
let cachedMtimeMs = 0;

function persist() {
  try {
    ensureDir(getDataDir());
    writeFileSync(DATA_FILE, JSON.stringify({ version: 1, notifications: rows }), "utf8");
    if (existsSync(DATA_FILE)) cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("notifications", { version: 1, notifications: rows }));
  } catch (e) {
    console.warn("[notifications] persist failed:", e);
  }
}

function reloadFromDisk() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { notifications?: NotificationRecord[] };
    rows.length = 0;
    for (const n of data.notifications ?? []) {
      if (n?.id && n.userId) rows.push(n);
    }
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[notifications] load failed:", e);
  }
}

function syncIfStale() {
  try {
    if (!existsSync(DATA_FILE)) return;
    if (statSync(DATA_FILE).mtimeMs !== cachedMtimeMs) reloadFromDisk();
  } catch {
    /* ignore */
  }
}

reloadFromDisk();

export function addNotification(input: Omit<NotificationRecord, "id" | "createdAt" | "readAt">): NotificationRecord {
  syncIfStale();
  if (input.groupKey) {
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      if (r.userId === input.userId && r.groupKey === input.groupKey && !r.readAt) rows.splice(i, 1);
    }
  }
  const row: NotificationRecord = {
    ...input,
    title: input.title.slice(0, 140),
    body: input.body.slice(0, 280),
    id: `ntf_${randomBytes(8).toString("hex")}`,
    createdAt: new Date().toISOString(),
  };
  rows.push(row);
  const mine = rows.filter((r) => r.userId === input.userId);
  if (mine.length > MAX_PER_USER) {
    const drop = new Set(mine.slice(0, mine.length - MAX_PER_USER).map((r) => r.id));
    for (let i = rows.length - 1; i >= 0; i--) if (drop.has(rows[i].id)) rows.splice(i, 1);
  }
  persist();
  return row;
}

export function listNotifications(userId: string, limit = 60): NotificationRecord[] {
  syncIfStale();
  return rows
    .filter((r) => r.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function unreadNotificationCount(userId: string): number {
  syncIfStale();
  return rows.reduce((n, r) => n + (r.userId === userId && !r.readAt ? 1 : 0), 0);
}

export function markNotificationsRead(userId: string, ids?: string[]): number {
  syncIfStale();
  const only = ids ? new Set(ids) : null;
  const at = new Date().toISOString();
  let n = 0;
  for (const r of rows) {
    if (r.userId !== userId || r.readAt) continue;
    if (only && !only.has(r.id)) continue;
    r.readAt = at;
    n++;
  }
  if (n) persist();
  return n;
}
