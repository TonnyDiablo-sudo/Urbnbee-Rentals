#!/usr/bin/env node
/**
 * Corrige fotos rotas o que no corresponden en anuncios ya guardados en el volumen.
 * Idempotente: sólo escribe si algo cambió. Se ejecuta en cada arranque (scripts/start.mjs).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

const cwd = process.cwd();
const rawDir = process.env.URBNBEE_DATA_DIR?.trim();
const dataDir = rawDir ? (isAbsolute(rawDir) ? rawDir : resolve(cwd, rawDir)) : join(cwd, "data");
const file = join(dataDir, "marketplace-store.json");

/** Fotos que Unsplash ya no sirve (404), para cualquier anuncio. */
const DEAD = {
  "1449158743715-0a90ebb615d9": "1449158743715-0a90ebb6d2d8",
  "1600573472592-401e3a5e5a41": "1583847268964-b28dc8f51f92",
  "1605146769289-440113cc31d1": "1464146072230-91cabc968266",
};

/** Fotos que no corresponden al tipo de lugar, por anuncio demo. */
const BY_LISTING = {
  lst_demo_sofia_roma: { "1600585154340-be6161a56a0c": "1522771739844-6a9f6d5f14af" },
  lst_demo_sofia_valle: { "1499793983690-e29da59ef1c2": "1758983065583-9cea714214f9" },
};

function swap(url, map) {
  for (const [from, to] of Object.entries(map)) {
    if (url.includes(`photo-${from}`)) return url.replace(`photo-${from}`, `photo-${to}`);
  }
  return url;
}

if (!existsSync(file)) process.exit(0);

const data = JSON.parse(readFileSync(file, "utf8"));
let changed = 0;
for (const l of data.listings ?? []) {
  if (!Array.isArray(l.photos)) continue;
  const map = { ...DEAD, ...(BY_LISTING[l.id] ?? {}) };
  const next = l.photos.map((p) => (typeof p === "string" ? swap(p, map) : p));
  const deduped = next.filter((p, i) => next.indexOf(p) === i);
  if (JSON.stringify(deduped) !== JSON.stringify(l.photos)) {
    l.photos = deduped;
    changed++;
  }
}

if (changed > 0) {
  writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  console.log(`[fix-listing-photos] ${changed} anuncio(s) corregido(s)`);
}
