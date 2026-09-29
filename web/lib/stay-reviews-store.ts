import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import type { StayReviewKind, StayReviewRecord } from "@/lib/stay-review-types";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "stay-reviews.json");
const rows: StayReviewRecord[] = [];
let cachedMtimeMs = 0;

function persist() {
  try {
    ensureDir(getDataDir());
    writeFileSync(DATA_FILE, JSON.stringify({ version: 1, reviews: rows }, null, 2), "utf8");
    if (existsSync(DATA_FILE)) cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[stay-reviews] persist failed:", e);
  }
}

function reloadFromDisk() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const raw = readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw) as { reviews?: StayReviewRecord[] };
    rows.length = 0;
    for (const r of data.reviews ?? []) {
      if (r?.id && r.bookingId && r.kind) rows.push(r);
    }
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[stay-reviews] load failed:", e);
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

export function listStayReviews(): StayReviewRecord[] {
  syncIfStale();
  return [...rows];
}

export function listListingStayReviews(listingId: string): StayReviewRecord[] {
  syncIfStale();
  return rows
    .filter((r) => r.listingId === listingId && r.kind === "guest_to_listing")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function findStayReview(bookingId: string, kind: StayReviewKind): StayReviewRecord | undefined {
  syncIfStale();
  return rows.find((r) => r.bookingId === bookingId && r.kind === kind);
}

export function listingStayRating(listingId: string): { avg: number; count: number } {
  const list = listListingStayReviews(listingId);
  if (list.length === 0) return { avg: 0, count: 0 };
  const avg = list.reduce((s, r) => s + r.rating, 0) / list.length;
  return { avg, count: list.length };
}

export function insertStayReview(
  input: Omit<StayReviewRecord, "id" | "createdAt">
): StayReviewRecord {
  syncIfStale();
  const row: StayReviewRecord = {
    ...input,
    id: `rev_${randomBytes(8).toString("hex")}`,
    createdAt: new Date().toISOString(),
  };
  rows.push(row);
  persist();
  return row;
}
