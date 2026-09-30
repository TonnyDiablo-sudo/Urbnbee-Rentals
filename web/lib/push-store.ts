import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

export type PushSubscriptionRecord = {
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
  userAgent?: string;
};

const DATA_FILE = join(getDataDir(), "push-subscriptions.json");
/** Un usuario con muchos dispositivos viejos no debe multiplicar cada envío sin límite. */
const MAX_PER_USER = 10;

const rows: PushSubscriptionRecord[] = [];
let cachedMtimeMs = 0;

function persist() {
  try {
    ensureDir(getDataDir());
    writeFileSync(DATA_FILE, JSON.stringify({ version: 1, subscriptions: rows }, null, 2), "utf8");
    if (existsSync(DATA_FILE)) cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("push-subscriptions", { version: 1, subscriptions: rows }));
  } catch (e) {
    console.warn("[push-store] persist failed:", e);
  }
}

function reloadFromDisk() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { subscriptions?: PushSubscriptionRecord[] };
    rows.length = 0;
    for (const s of data.subscriptions ?? []) {
      if (s?.userId && s.endpoint && s.keys?.p256dh && s.keys?.auth) rows.push(s);
    }
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[push-store] load failed:", e);
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

export function saveSubscription(rec: Omit<PushSubscriptionRecord, "createdAt">): void {
  syncIfStale();
  const existing = rows.findIndex((s) => s.endpoint === rec.endpoint);
  if (existing >= 0) rows.splice(existing, 1);
  rows.push({ ...rec, createdAt: new Date().toISOString() });
  const mine = rows.filter((s) => s.userId === rec.userId);
  for (const old of mine.slice(0, Math.max(0, mine.length - MAX_PER_USER))) {
    rows.splice(rows.indexOf(old), 1);
  }
  persist();
}

export function removeSubscription(endpoint: string, userId?: string): void {
  syncIfStale();
  const i = rows.findIndex((s) => s.endpoint === endpoint && (!userId || s.userId === userId));
  if (i < 0) return;
  rows.splice(i, 1);
  persist();
}

export function subscriptionsForUser(userId: string): PushSubscriptionRecord[] {
  syncIfStale();
  return rows.filter((s) => s.userId === userId);
}

export function hasSubscription(userId: string, endpoint: string): boolean {
  syncIfStale();
  return rows.some((s) => s.userId === userId && s.endpoint === endpoint);
}
