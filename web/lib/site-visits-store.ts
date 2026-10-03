import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { analyticsDayKey, shiftDayKey } from "@/lib/analytics-day";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "site-visits.json");
const KEEP_DAYS = 1200;
const FLUSH_MS = 15_000;

/** Por día y por lugar ("país|estado|ciudad"): [páginas vistas, visitantes únicos]. */
type VisitsDoc = {
  days: Record<string, Record<string, [number, number]>>;
  /** Último lugar desde el que entró cada usuario con sesión: ubica las cuentas nuevas. */
  userPlaces: Record<string, string>;
};

let doc: VisitsDoc = { days: {}, userPlaces: {} };
let cachedMtimeMs = -1;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
/** Visitante único por día. Se pierde al reiniciar: puede contar doble a quien vuelva ese mismo día. */
const seen = new Set<string>();
let seenDay = "";

function load() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs || flushTimer) return;
    const raw = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Partial<VisitsDoc>;
    doc = { days: raw.days ?? {}, userPlaces: raw.userPlaces ?? {} };
    cachedMtimeMs = m;
  } catch (e) {
    console.warn("[site-visits] load failed:", e);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      const cutoff = shiftDayKey(analyticsDayKey(), -KEEP_DAYS);
      for (const d of Object.keys(doc.days)) if (d < cutoff) delete doc.days[d];
      ensureDir(getDataDir());
      const snapshot = { version: 1 as const, ...doc };
      writeFileSync(DATA_FILE, JSON.stringify(snapshot), "utf8");
      cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
      scheduleMysql(() => upsertJsonBlob("site-visits", snapshot));
    } catch (e) {
      console.warn("[site-visits] persist failed:", e);
    }
  }, FLUSH_MS);
}

export function recordSiteVisit(opts: { visitorId: string; placeKey: string; userId?: string }) {
  load();
  const day = analyticsDayKey();
  if (day !== seenDay) {
    seen.clear();
    seenDay = day;
  }
  const row = ((doc.days[day] ??= {})[opts.placeKey] ??= [0, 0]);
  row[0] += 1;
  if (!seen.has(opts.visitorId)) {
    seen.add(opts.visitorId);
    row[1] += 1;
  }
  if (opts.userId) doc.userPlaces[opts.userId] = opts.placeKey;
  scheduleFlush();
}

export function getSiteVisitDays(): VisitsDoc["days"] {
  load();
  return doc.days;
}

export function getUserPlaces(): VisitsDoc["userPlaces"] {
  load();
  return doc.userPlaces;
}
