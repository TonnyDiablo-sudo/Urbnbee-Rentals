import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "beeagent-idempotency.json");
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX = 400;

type Row = { key: string; status: number; body: unknown; at: string };
const rows = new Map<string, Row>();
let cachedMtime = 0;

function persist() {
  try {
    ensureDir(getDataDir());
    writeFileSync(DATA_FILE, JSON.stringify({ version: 1, rows: [...rows.values()] }, null, 2), "utf8");
    if (existsSync(DATA_FILE)) cachedMtime = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[beeagent-idempotency] persist:", e);
  }
}

function reload() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { rows?: Row[] };
    rows.clear();
    const now = Date.now();
    for (const r of data.rows ?? []) {
      if (!r?.key || now - new Date(r.at).getTime() > TTL_MS) continue;
      rows.set(r.key, r);
    }
    cachedMtime = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[beeagent-idempotency] load:", e);
  }
}

function sync() {
  try {
    if (!existsSync(DATA_FILE)) return;
    if (statSync(DATA_FILE).mtimeMs === cachedMtime) return;
    reload();
  } catch {
    /* ignore */
  }
}

reload();

function makeKey(method: string, path: string, raw: string): string {
  return `${method.toUpperCase()}:${path}:${raw.trim().slice(0, 200)}`;
}

export function replayPartnerIdempotency(
  method: string,
  path: string,
  header: string | null
): { status: number; body: unknown } | null {
  const raw = header?.trim();
  if (!raw) return null;
  sync();
  const row = rows.get(makeKey(method, path, raw));
  if (!row) return null;
  if (Date.now() - new Date(row.at).getTime() > TTL_MS) return null;
  if (row.status < 200 || row.status >= 300) return null;
  return { status: row.status, body: row.body };
}

export function rememberPartnerIdempotency(
  method: string,
  path: string,
  header: string | null,
  status: number,
  body: unknown
): void {
  const raw = header?.trim();
  if (!raw) return;
  if (status < 200 || status >= 300) return;
  sync();
  rows.set(makeKey(method, path, raw), {
    key: makeKey(method, path, raw),
    status,
    body,
    at: new Date().toISOString(),
  });
  if (rows.size > MAX) {
    const ordered = [...rows.values()].sort((a, b) => a.at.localeCompare(b.at));
    for (const old of ordered.slice(0, rows.size - MAX)) rows.delete(old.key);
  }
  persist();
}
