import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";
import type { ReportAiDecision, UserReportRecord, UserReportStatus } from "@/lib/user-reports-types";

const DATA_FILE = join(getDataDir(), "user-reports.json");

const reports = new Map<string, UserReportRecord>();
let cachedMtimeMs = 0;

function persist() {
  try {
    ensureDir(getDataDir());
    const snapshot = { version: 1 as const, reports: [...reports.values()] };
    writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    if (existsSync(DATA_FILE)) cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("user-reports", snapshot));
  } catch (e) {
    console.warn("[user-reports] persist failed:", e);
  }
}

function syncIfStale() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { reports?: UserReportRecord[] };
    reports.clear();
    for (const r of data.reports ?? []) if (r?.id) reports.set(r.id, r);
    cachedMtimeMs = m;
  } catch (e) {
    console.warn("[user-reports] load failed:", e);
  }
}

const newestFirst = (a: UserReportRecord, b: UserReportRecord) => b.createdAt.localeCompare(a.createdAt);

export function createUserReport(
  input: Omit<UserReportRecord, "id" | "status" | "createdAt" | "updatedAt">
): UserReportRecord {
  syncIfStale();
  const now = new Date().toISOString();
  const row: UserReportRecord = {
    ...input,
    id: `rpt_${randomBytes(8).toString("hex")}`,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  reports.set(row.id, row);
  persist();
  return row;
}

export function listUserReports(): UserReportRecord[] {
  syncIfStale();
  return [...reports.values()].sort(newestFirst);
}

export function findUserReport(id: string): UserReportRecord | undefined {
  syncIfStale();
  return reports.get(id);
}

export function listReportsByReporter(userId: string): UserReportRecord[] {
  syncIfStale();
  return [...reports.values()].filter((r) => r.reporterId === userId).sort(newestFirst);
}

export function listReportsAgainst(userId: string): UserReportRecord[] {
  syncIfStale();
  return [...reports.values()].filter((r) => r.targetUserId === userId).sort(newestFirst);
}

/** Reportes abiertos hoy de esta persona: frena el spam. */
export function countRecentReportsBy(userId: string, sinceMs: number): number {
  syncIfStale();
  let n = 0;
  for (const r of reports.values()) {
    if (r.reporterId === userId && Date.parse(r.createdAt) >= sinceMs) n++;
  }
  return n;
}

export function updateUserReport(
  id: string,
  patch: {
    status?: UserReportStatus;
    adminNote?: string;
    adminReply?: string;
    targetUserId?: string | null;
    aiDecision?: ReportAiDecision;
    aiReason?: string;
    aiModel?: string;
    aiAt?: string;
    aiAttempts?: number;
  }
): UserReportRecord | undefined {
  syncIfStale();
  const prev = reports.get(id);
  if (!prev) return undefined;
  const now = new Date().toISOString();
  const next: UserReportRecord = { ...prev, updatedAt: now };
  if (patch.status) {
    next.status = patch.status;
    if (patch.status === "resolved" || patch.status === "dismissed") next.resolvedAt = prev.resolvedAt ?? now;
    else delete next.resolvedAt;
  }
  if (patch.adminNote !== undefined) next.adminNote = patch.adminNote.trim() || undefined;
  if (patch.adminReply !== undefined) next.adminReply = patch.adminReply.trim() || undefined;
  if (patch.targetUserId !== undefined) next.targetUserId = patch.targetUserId || undefined;
  if (patch.aiDecision) next.aiDecision = patch.aiDecision;
  if (patch.aiReason !== undefined) next.aiReason = patch.aiReason.trim().slice(0, 300) || undefined;
  if (patch.aiModel) next.aiModel = patch.aiModel;
  if (patch.aiAt) next.aiAt = patch.aiAt;
  if (patch.aiAttempts !== undefined) next.aiAttempts = patch.aiAttempts;
  reports.set(id, next);
  persist();
  return next;
}

export function deleteReportsForAccount(userId: string): void {
  syncIfStale();
  let changed = false;
  for (const [id, r] of reports) {
    if (r.reporterId === userId) {
      reports.delete(id);
      changed = true;
    }
  }
  if (changed) persist();
}
