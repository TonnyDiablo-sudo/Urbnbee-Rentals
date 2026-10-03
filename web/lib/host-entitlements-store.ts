import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import type { HostEntitlementRecord, HostSku } from "@/lib/host-entitlement-types";
import { isHostSku } from "@/lib/host-entitlement-types";
import { scheduleMysql, upsertHostEntitlementRow } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "host-entitlements.json");
const rows = new Map<string, HostEntitlementRecord>();
let cachedMtimeMs = 0;

function keyOf(hostId: string, sku: HostSku): string {
  return `${hostId}::${sku}`;
}

function persist() {
  try {
    ensureDir(getDataDir());
    const snapshot = { version: 1 as const, entitlements: [...rows.values()] };
    writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    if (existsSync(DATA_FILE)) cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(async () => {
      for (const r of snapshot.entitlements) await upsertHostEntitlementRow(r);
    });
  } catch (e) {
    console.warn("[host-entitlements] persist failed:", e);
  }
}

function reloadFromDisk() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const raw = readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw) as { entitlements?: HostEntitlementRecord[] };
    rows.clear();
    for (const r of data.entitlements ?? []) {
      if (!r?.hostId || !isHostSku(r.sku) || !r.status) continue;
      rows.set(keyOf(r.hostId, r.sku), r);
    }
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[host-entitlements] load failed:", e);
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

export function getHostEntitlement(hostId: string, sku: HostSku): HostEntitlementRecord | undefined {
  syncIfStale();
  return rows.get(keyOf(hostId, sku));
}

export function listHostEntitlements(hostId: string): HostEntitlementRecord[] {
  syncIfStale();
  return [...rows.values()].filter((r) => r.hostId === hostId);
}

export function upsertHostEntitlement(row: HostEntitlementRecord): HostEntitlementRecord {
  syncIfStale();
  const now = new Date().toISOString();
  const prev = rows.get(keyOf(row.hostId, row.sku));
  const wasActive = prev?.status === "active";
  const isActive = row.status === "active";
  const startedAt = isActive ? (wasActive ? (row.startedAt ?? prev?.startedAt) : now) : (row.startedAt ?? prev?.startedAt);
  const next = { ...row, startedAt, updatedAt: row.updatedAt || now };
  rows.set(keyOf(next.hostId, next.sku), next);
  persist();
  return next;
}

export function deleteHostEntitlements(hostId: string): void {
  syncIfStale();
  let changed = false;
  for (const [key, row] of rows) {
    if (row.hostId !== hostId) continue;
    rows.delete(key);
    changed = true;
  }
  if (changed) persist();
}

export function listAllHostEntitlements(): HostEntitlementRecord[] {
  syncIfStale();
  return [...rows.values()];
}
