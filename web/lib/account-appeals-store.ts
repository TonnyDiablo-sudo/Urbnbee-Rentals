import "server-only";
import { randomBytes } from "crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

export type AppealStatus = "pending" | "restored" | "upheld";

export type AccountAppeal = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  message: string;
  status: AppealStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
};

const DATA_FILE = join(getDataDir(), "account-appeals.json");
const rows = new Map<string, AccountAppeal>();
let cachedMtimeMs = 0;

function persist() {
  try {
    ensureDir(getDataDir());
    const snapshot = { version: 1 as const, appeals: [...rows.values()] };
    writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    if (existsSync(DATA_FILE)) cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("account-appeals", snapshot));
  } catch (e) {
    console.warn("[account-appeals] persist failed:", e);
  }
}

function syncIfStale() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { appeals?: AccountAppeal[] };
    rows.clear();
    for (const r of data.appeals ?? []) if (r?.id) rows.set(r.id, r);
    cachedMtimeMs = m;
  } catch (e) {
    console.warn("[account-appeals] load failed:", e);
  }
}

export function createAppeal(input: Omit<AccountAppeal, "id" | "status" | "createdAt">): AccountAppeal {
  syncIfStale();
  const row: AccountAppeal = {
    ...input,
    id: `apl_${randomBytes(8).toString("hex")}`,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  rows.set(row.id, row);
  persist();
  return row;
}

export function listAppeals(): AccountAppeal[] {
  syncIfStale();
  return [...rows.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function findAppeal(id: string): AccountAppeal | undefined {
  syncIfStale();
  return rows.get(id);
}

export function latestAppealFor(userId: string): AccountAppeal | undefined {
  return listAppeals().find((a) => a.userId === userId);
}

export function updateAppeal(
  id: string,
  patch: { status: Exclude<AppealStatus, "pending">; decidedBy: string; decisionNote?: string }
): AccountAppeal | undefined {
  syncIfStale();
  const prev = rows.get(id);
  if (!prev) return undefined;
  const next: AccountAppeal = {
    ...prev,
    status: patch.status,
    decidedAt: new Date().toISOString(),
    decidedBy: patch.decidedBy,
    decisionNote: patch.decisionNote?.trim().slice(0, 500) || undefined,
  };
  rows.set(id, next);
  persist();
  return next;
}
