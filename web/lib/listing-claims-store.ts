import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "listing-claims.json");

export type ListingClaimRequest = {
  id: string;
  listingId: string;
  listingTitle: string;
  hostId: string;
  kind: "claim" | "remove";
  name: string;
  contact: string;
  message: string;
  status: "open" | "done";
  resolution?: "listing_deleted" | "handed_over" | "dismissed";
  createdAt: string;
  resolvedAt?: string;
};

const claims = new Map<string, ListingClaimRequest>();
let cachedMtimeMs = 0;

function persist() {
  try {
    ensureDir(getDataDir());
    const snapshot = { version: 1 as const, claims: [...claims.values()] };
    writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    if (existsSync(DATA_FILE)) cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("listing-claims", snapshot));
  } catch (e) {
    console.warn("[listing-claims] persist failed:", e);
  }
}

function syncIfStale() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { claims?: ListingClaimRequest[] };
    claims.clear();
    for (const c of data.claims ?? []) if (c?.id) claims.set(c.id, c);
    cachedMtimeMs = m;
  } catch (e) {
    console.warn("[listing-claims] load failed:", e);
  }
}

export function createClaimRequest(
  input: Omit<ListingClaimRequest, "id" | "status" | "createdAt">
): ListingClaimRequest {
  syncIfStale();
  const row: ListingClaimRequest = {
    ...input,
    id: `clm_${randomBytes(8).toString("hex")}`,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  claims.set(row.id, row);
  persist();
  return row;
}

export function listClaimRequests(): ListingClaimRequest[] {
  syncIfStale();
  return [...claims.values()].sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function resolveClaimRequest(
  id: string,
  resolution: NonNullable<ListingClaimRequest["resolution"]>
): ListingClaimRequest | undefined {
  syncIfStale();
  const prev = claims.get(id);
  if (!prev) return undefined;
  const next: ListingClaimRequest = { ...prev, status: "done", resolution, resolvedAt: new Date().toISOString() };
  claims.set(id, next);
  persist();
  return next;
}
