import "server-only";
import { createHash } from "crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { analyticsDayKey } from "@/lib/analytics-day";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "listing-stats.json");
const KEEP_DAYS = 400;
const FLUSH_MS = 15_000;

/** Por anuncio y por día (YYYY-MM-DD): v = vistas únicas, c = contactos desbloqueados. */
type DayCounts = { v: number; c: number };
type StatsDoc = Record<string, Record<string, DayCounts>>;

let doc: StatsDoc = {};
let cachedMtimeMs = -1;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
/** Una vista por persona, anuncio y día. Se pierde al reiniciar: sólo evita inflar con recargas. */
const seen = new Set<string>();
let seenDay = "";

/** Recarga si otro proceso (p. ej. scripts/seed-demo-stats.mjs) cambió el archivo, salvo que haya conteos sin guardar. */
function load() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs || flushTimer) return;
    doc = (JSON.parse(readFileSync(DATA_FILE, "utf8")) as { listings?: StatsDoc }).listings ?? {};
    cachedMtimeMs = m;
  } catch (e) {
    console.warn("[listing-stats] load failed:", e);
  }
}

function prune() {
  const cutoff = dayKey(new Date(Date.now() - KEEP_DAYS * 86_400_000));
  for (const days of Object.values(doc)) {
    for (const d of Object.keys(days)) if (d < cutoff) delete days[d];
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      prune();
      ensureDir(getDataDir());
      const snapshot = { version: 1 as const, listings: doc };
      writeFileSync(DATA_FILE, JSON.stringify(snapshot), "utf8");
      cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
      scheduleMysql(() => upsertJsonBlob("listing-stats", snapshot));
    } catch (e) {
      console.warn("[listing-stats] persist failed:", e);
    }
  }, FLUSH_MS);
}

function dayKey(d = new Date()): string {
  return analyticsDayKey(d);
}

const BOT_UA = /bot|crawler|spider|crawling|preview|facebookexternalhit|whatsapp|slurp|bingpreview|headless|lighthouse/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  return !ua || BOT_UA.test(ua);
}

/** Identificador anónimo del visitante: usuario si hay sesión; si no, IP + navegador con hash. */
export function viewerKeyFrom(opts: { userId?: string; ip?: string | null; ua?: string | null }): string | null {
  if (opts.ua && BOT_UA.test(opts.ua)) return null;
  if (opts.userId) return `u:${opts.userId}`;
  return `a:${createHash("sha256").update(`${opts.ip ?? ""}|${opts.ua ?? ""}`).digest("hex").slice(0, 24)}`;
}

function bump(listingId: string, viewerKey: string, field: keyof DayCounts) {
  load();
  const day = dayKey();
  if (day !== seenDay) {
    seen.clear();
    seenDay = day;
  }
  const key = `${field}|${listingId}|${viewerKey}`;
  if (seen.has(key)) return;
  seen.add(key);
  const days = (doc[listingId] ??= {});
  const counts = (days[day] ??= { v: 0, c: 0 });
  counts[field] += 1;
  scheduleFlush();
}

export function recordListingView(listingId: string, viewerKey: string | null) {
  if (viewerKey) bump(listingId, viewerKey, "v");
}

export function recordContactView(listingId: string, viewerKey: string | null) {
  if (viewerKey) bump(listingId, viewerKey, "c");
}

export type ListingStats = {
  views7: number;
  views30: number;
  viewsTotal: number;
  contacts7: number;
  contacts30: number;
  contactsTotal: number;
  /** Últimos 30 días, del más viejo al de hoy. */
  daily: { day: string; v: number; c: number }[];
};

export function getListingStats(listingId: string): ListingStats {
  load();
  const days = doc[listingId] ?? {};
  const today = Date.now();
  const daily: ListingStats["daily"] = [];
  for (let i = 29; i >= 0; i--) {
    const day = dayKey(new Date(today - i * 86_400_000));
    const c = days[day];
    daily.push({ day, v: c?.v ?? 0, c: c?.c ?? 0 });
  }
  const sum = (rows: typeof daily, f: "v" | "c") => rows.reduce((s, r) => s + r[f], 0);
  let viewsTotal = 0;
  let contactsTotal = 0;
  for (const c of Object.values(days)) {
    viewsTotal += c.v;
    contactsTotal += c.c;
  }
  return {
    views7: sum(daily.slice(-7), "v"),
    views30: sum(daily, "v"),
    viewsTotal,
    contacts7: sum(daily.slice(-7), "c"),
    contacts30: sum(daily, "c"),
    contactsTotal,
    daily,
  };
}

/** Todos los anuncios: listingId → día → conteos. Sólo lectura. */
export function getAllListingDailyStats(): Readonly<StatsDoc> {
  load();
  return doc;
}

export function getStatsTotalsForListings(listingIds: string[]): { views: number; contacts: number } {
  let views = 0;
  let contacts = 0;
  for (const id of listingIds) {
    const s = getListingStats(id);
    views += s.viewsTotal;
    contacts += s.contactsTotal;
  }
  return { views, contacts };
}
