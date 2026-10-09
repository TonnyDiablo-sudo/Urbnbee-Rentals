import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

type BlockRow = { blockerId: string; blockedId: string; createdAt: string };

const DATA_FILE = join(getDataDir(), "user-blocks.json");
const rows: BlockRow[] = [];
let cachedMtimeMs = 0;

function persist() {
  try {
    ensureDir(getDataDir());
    writeFileSync(DATA_FILE, JSON.stringify({ version: 1, blocks: rows }, null, 2), "utf8");
    if (existsSync(DATA_FILE)) cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[user-blocks] persist failed:", e);
  }
}

function reload() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { blocks?: BlockRow[] };
    rows.length = 0;
    for (const b of data.blocks ?? []) {
      if (b?.blockerId && b.blockedId && b.blockerId !== b.blockedId) rows.push(b);
    }
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[user-blocks] load failed:", e);
  }
}

function sync() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m !== cachedMtimeMs) reload();
  } catch {
    /* ignore */
  }
}

reload();

export function isBlockedBy(blockerId: string, blockedId: string): boolean {
  sync();
  return rows.some((b) => b.blockerId === blockerId && b.blockedId === blockedId);
}

/** Cualquiera de los dos bloqueó al otro: ya no se pueden escribir. */
export function eitherBlocked(a: string, b: string): boolean {
  return isBlockedBy(a, b) || isBlockedBy(b, a);
}

export function blockUser(blockerId: string, blockedId: string): void {
  sync();
  if (!blockerId || !blockedId || blockerId === blockedId) return;
  if (isBlockedBy(blockerId, blockedId)) return;
  rows.push({ blockerId, blockedId, createdAt: new Date().toISOString() });
  persist();
}

export function unblockUser(blockerId: string, blockedId: string): void {
  sync();
  const next = rows.filter((b) => !(b.blockerId === blockerId && b.blockedId === blockedId));
  if (next.length === rows.length) return;
  rows.length = 0;
  rows.push(...next);
  persist();
}
