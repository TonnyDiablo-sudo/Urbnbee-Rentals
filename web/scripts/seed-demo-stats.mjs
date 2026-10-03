#!/usr/bin/env node
/**
 * Estadísticas de muestra (vistas y contactos por día) para los anuncios de las cuentas demo,
 * así el panel "Estadísticas y sugerencias" se ve con datos.
 *
 * Idempotente: sólo llena los días que faltan; nunca pisa conteos reales.
 * Se ejecuta en cada arranque (scripts/start.mjs).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

const cwd = process.cwd();
const rawDir = process.env.URBNBEE_DATA_DIR?.trim();
const dataDir = rawDir ? (isAbsolute(rawDir) ? rawDir : resolve(cwd, rawDir)) : join(cwd, "data");
mkdirSync(dataDir, { recursive: true });

const DAYS = 45;
const DEMO_HOST = /^usr_(seed|demo|show)_/;
const storeFile = join(dataDir, "marketplace-store.json");
const statsFile = join(dataDir, "listing-stats.json");

if (!existsSync(storeFile)) {
  console.log("[seed-demo-stats] sin marketplace-store.json; nada que hacer");
  process.exit(0);
}

const store = JSON.parse(readFileSync(storeFile, "utf8"));
const demoHosts = new Set(
  (store.users ?? []).filter((u) => DEMO_HOST.test(u.id) || u.email?.endsWith("@urbnbee.test")).map((u) => u.id)
);
const listings = (store.listings ?? []).filter((l) => l.published && demoHosts.has(l.hostId));

let doc = { version: 1, listings: {} };
if (existsSync(statsFile)) {
  try {
    doc = JSON.parse(readFileSync(statsFile, "utf8"));
    doc.listings ??= {};
  } catch {
    console.warn("[seed-demo-stats] listing-stats.json ilegible; no se toca");
    process.exit(0);
  }
}

/** Número estable 0–1 por anuncio y día: el mismo arranque siempre da lo mismo. */
function rand(key) {
  return parseInt(createHash("sha256").update(key).digest("hex").slice(0, 8), 16) / 0xffffffff;
}

let filled = 0;
const today = Date.now();
for (const l of listings) {
  const days = (doc.listings[l.id] ??= {});
  const popularity = 0.6 + rand(`${l.id}|pop`) * 1.4;
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(today - i * 86_400_000);
    const day = d.toISOString().slice(0, 10);
    if (days[day]) continue;
    const weekend = d.getUTCDay() === 5 || d.getUTCDay() === 6 ? 1.5 : 1;
    const ramp = 0.55 + 0.45 * ((DAYS - i) / DAYS);
    const v = Math.round((3 + rand(`${l.id}|${day}|v`) * 16) * popularity * weekend * ramp);
    const c = Math.round(v * (0.05 + rand(`${l.id}|${day}|c`) * 0.12));
    days[day] = { v, c };
    filled++;
  }
}

if (filled) {
  writeFileSync(statsFile, JSON.stringify(doc), "utf8");
  console.log(`[seed-demo-stats] ${filled} días llenados en ${listings.length} anuncios demo`);
} else {
  console.log("[seed-demo-stats] ya estaba al día");
}
