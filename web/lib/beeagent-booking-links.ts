import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "beeagent-booking-links.json");
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type BeeagentBookingLink = {
  ref: string;
  listingId: string;
  hostId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  conversationKey?: string;
  expiresAt: string;
  createdAt: string;
};

const rows = new Map<string, BeeagentBookingLink>();
let cachedMtime = 0;

function persist() {
  try {
    ensureDir(getDataDir());
    writeFileSync(
      DATA_FILE,
      JSON.stringify({ version: 1, links: [...rows.values()] }, null, 2),
      "utf8"
    );
    if (existsSync(DATA_FILE)) cachedMtime = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[beeagent-booking-links] persist:", e);
  }
}

function reload() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { links?: BeeagentBookingLink[] };
    rows.clear();
    const now = Date.now();
    for (const l of data.links ?? []) {
      if (!l?.ref || new Date(l.expiresAt).getTime() <= now) continue;
      rows.set(l.ref, l);
    }
    cachedMtime = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[beeagent-booking-links] load:", e);
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

export function createBeeagentBookingLink(input: {
  listingId: string;
  hostId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  conversationKey?: string;
}): BeeagentBookingLink {
  sync();
  const now = Date.now();
  const rec: BeeagentBookingLink = {
    ref: `bl_${randomBytes(8).toString("hex")}`,
    listingId: input.listingId,
    hostId: input.hostId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guests: Math.max(1, Math.round(input.guests)),
    conversationKey: input.conversationKey,
    expiresAt: new Date(now + TTL_MS).toISOString(),
    createdAt: new Date(now).toISOString(),
  };
  rows.set(rec.ref, rec);
  persist();
  return rec;
}

export function getBeeagentBookingLink(ref: string): BeeagentBookingLink | undefined {
  sync();
  const rec = rows.get(ref.trim());
  if (!rec) return undefined;
  if (new Date(rec.expiresAt).getTime() <= Date.now()) {
    rows.delete(ref);
    persist();
    return undefined;
  }
  return rec;
}
