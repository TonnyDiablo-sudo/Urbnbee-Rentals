import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

/**
 * Lugares pagados por anuncio (limpieza, motor de reservas). El lugar se queda con el primer
 * anuncio al que se le asigna: apagarlo o borrar el anuncio no lo libera para otro.
 */
export type SlotTool = "cleaning" | "engine";

const DATA_FILE = join(getDataDir(), "listing-slots.json");
let slots: Record<string, string[]> = {};
let cachedMtimeMs = 0;

const keyOf = (hostId: string, tool: SlotTool) => `${tool}:${hostId}`;

function load() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { slots?: Record<string, string[]> };
    slots = data.slots && typeof data.slots === "object" ? data.slots : {};
    cachedMtimeMs = m;
  } catch (e) {
    console.warn("[listing-slots] load failed:", e);
  }
}

function persist() {
  try {
    ensureDir(getDataDir());
    const snapshot = { version: 1 as const, slots };
    writeFileSync(DATA_FILE, JSON.stringify(snapshot), "utf8");
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("listing-slots", snapshot));
  } catch (e) {
    console.warn("[listing-slots] persist failed:", e);
  }
}

load();

/** Anuncios que ya tienen su lugar, en el orden en que se asignaron. */
export function boundListings(hostId: string, tool: SlotTool): string[] {
  load();
  return slots[keyOf(hostId, tool)] ?? [];
}

export function bindListing(hostId: string, tool: SlotTool, listingId: string): void {
  load();
  const key = keyOf(hostId, tool);
  const list = slots[key] ?? [];
  if (list.includes(listingId)) return;
  slots[key] = [...list, listingId];
  persist();
}
