import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import {
  DEFAULT_BOT_PERMISSIONS,
  sanitizeBotPermissions,
  type BotPermission,
  type BotPermissions,
} from "@/lib/beeagent-permission-defs";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

type Row = { permissions: BotPermissions; updatedAt: string };

const DATA_FILE = join(getDataDir(), "beeagent-permissions.json");
let rows: Record<string, Row> = {};
let cachedMtimeMs = 0;

function load() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { hosts?: Record<string, Row> };
    rows = data.hosts && typeof data.hosts === "object" ? data.hosts : {};
    cachedMtimeMs = m;
  } catch (e) {
    console.warn("[beeagent-permissions] load failed:", e);
  }
}

function persist() {
  try {
    ensureDir(getDataDir());
    const snapshot = { version: 1 as const, hosts: rows };
    writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("beeagent-permissions", snapshot));
  } catch (e) {
    console.warn("[beeagent-permissions] persist failed:", e);
  }
}

load();

export function getBotPermissions(hostId: string): BotPermissions {
  load();
  const row = rows[hostId];
  return row ? sanitizeBotPermissions(row.permissions) : { ...DEFAULT_BOT_PERMISSIONS };
}

export function getBotPermissionsUpdatedAt(hostId: string): string | null {
  load();
  return rows[hostId]?.updatedAt ?? null;
}

export function botCan(hostId: string, permission: BotPermission): boolean {
  return getBotPermissions(hostId)[permission];
}

export function setBotPermissions(hostId: string, raw: unknown): Row {
  load();
  const row = { permissions: sanitizeBotPermissions(raw, getBotPermissions(hostId)), updatedAt: new Date().toISOString() };
  rows[hostId] = row;
  persist();
  return row;
}

export function clearBotPermissions(hostId: string): void {
  load();
  if (!rows[hostId]) return;
  delete rows[hostId];
  persist();
}
