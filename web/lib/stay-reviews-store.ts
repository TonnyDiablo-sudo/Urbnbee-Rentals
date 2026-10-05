import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { isPublishedReview, type StayReviewKind, type StayReviewRecord } from "@/lib/stay-review-types";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { weightedRating, type RatingSummary } from "@/lib/review-categories";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "stay-reviews.json");
const rows: StayReviewRecord[] = [];
let cachedMtimeMs = 0;

function persist() {
  try {
    ensureDir(getDataDir());
    writeFileSync(DATA_FILE, JSON.stringify({ version: 1, reviews: rows }, null, 2), "utf8");
    if (existsSync(DATA_FILE)) cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("stay-reviews", { version: 1, reviews: rows }));
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
    .filter((r) => r.listingId === listingId && r.kind === "guest_to_listing" && isPublishedReview(r))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function findStayReview(bookingId: string, kind: StayReviewKind): StayReviewRecord | undefined {
  syncIfStale();
  return rows.find((r) => r.bookingId === bookingId && r.kind === kind);
}

/** Promedio del anuncio; las reseñas recientes pesan más (bloques de 6 meses). */
export function listingStayRating(listingId: string): RatingSummary {
  return weightedRating(listListingStayReviews(listingId));
}

/** Calificación del anfitrión con las reseñas de todos sus anuncios, ponderada igual. */
export function hostStayRating(hostId: string): RatingSummary {
  syncIfStale();
  return weightedRating(rows.filter((r) => r.hostId === hostId && r.kind === "guest_to_listing" && isPublishedReview(r)));
}

/** Calificación de un huésped con las reseñas que le dejaron los anfitriones. */
export function guestStayRating(guestUserId: string): RatingSummary {
  syncIfStale();
  return weightedRating(rows.filter((r) => r.guestUserId === guestUserId && r.kind === "host_to_guest" && isPublishedReview(r)));
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

export function patchStayReview(
  id: string,
  patch: Partial<Pick<StayReviewRecord, "status" | "statusReason" | "reviewAttempts" | "reviewedAt" | "reviewedBy">>
): StayReviewRecord | undefined {
  syncIfStale();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return undefined;
  rows[i] = { ...rows[i], ...patch };
  persist();
  return rows[i];
}

/** Una reseña rechazada se puede volver a escribir: se borra la anterior. */
export function removeStayReview(id: string): void {
  syncIfStale();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return;
  rows.splice(i, 1);
  persist();
}
