import "server-only";
import { randomBytes } from "crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

export type SupplyItem = {
  id: string;
  hostId: string;
  /** null = insumo general (bodega), si no, el anuncio donde está. */
  listingId: string | null;
  name: string;
  emoji: string;
  qty: number;
  /** Al llegar a este número (o menos) se avisa para comprar. */
  min: number;
  /** "host" o ids de miembros del equipo a quienes avisar. */
  alertTo: string[];
  /** Desde cuándo está en el mínimo; se borra al reponer. */
  lowSince?: string;
  updatedAt: string;
  updatedBy: string;
};

const DATA_FILE = join(getDataDir(), "supplies.json");
let items: SupplyItem[] = [];
let cachedMtimeMs = 0;

function load() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { items?: SupplyItem[] };
    items = Array.isArray(data.items) ? data.items : [];
    cachedMtimeMs = m;
  } catch (e) {
    console.warn("[supplies] load failed:", e);
  }
}

function persist() {
  try {
    ensureDir(getDataDir());
    const snapshot = { version: 1 as const, items };
    writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("supplies", snapshot));
  } catch (e) {
    console.warn("[supplies] persist failed:", e);
  }
}

load();

export function listSupplies(hostId: string): SupplyItem[] {
  load();
  return items.filter((i) => i.hostId === hostId);
}

export function getSupply(id: string): SupplyItem | undefined {
  load();
  return items.find((i) => i.id === id);
}

export function addSupply(input: Omit<SupplyItem, "id" | "updatedAt">): SupplyItem {
  load();
  const item: SupplyItem = { ...input, id: `sp_${randomBytes(8).toString("hex")}`, updatedAt: new Date().toISOString() };
  items.push(item);
  persist();
  return item;
}

export function updateSupply(id: string, patch: Partial<Omit<SupplyItem, "id" | "hostId">>): SupplyItem | undefined {
  load();
  const i = items.findIndex((x) => x.id === id);
  if (i === -1) return undefined;
  items[i] = { ...items[i], ...patch, updatedAt: new Date().toISOString() };
  persist();
  return items[i];
}

export function deleteSupply(id: string): boolean {
  load();
  const before = items.length;
  items = items.filter((x) => x.id !== id);
  if (items.length === before) return false;
  persist();
  return true;
}
