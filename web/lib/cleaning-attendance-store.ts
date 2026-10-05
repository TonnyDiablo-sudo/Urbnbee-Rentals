import "server-only";
import { randomBytes } from "crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

/** Una marca de entrada o salida en una limpieza, con la ubicación del momento. */
export type AttendancePunch = {
  id: string;
  hostId: string;
  taskId: string;
  listingId: string;
  /** "host" o el id del miembro del equipo. */
  actor: string;
  userId: string;
  kind: "in" | "out";
  at: string;
  lat: number;
  lng: number;
  accuracyM: number;
  /** Distancia al punto exacto del anuncio. */
  distanceM: number;
  onSite: boolean;
  /** web, ios o android. */
  platform: string;
};

const DATA_FILE = join(getDataDir(), "cleaning-attendance.json");
let punches: AttendancePunch[] = [];
let cachedMtimeMs = 0;

function load() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { punches?: AttendancePunch[] };
    punches = Array.isArray(data.punches) ? data.punches : [];
    cachedMtimeMs = m;
  } catch (e) {
    console.warn("[attendance] load failed:", e);
  }
}

function persist() {
  try {
    ensureDir(getDataDir());
    const snapshot = { version: 1 as const, punches };
    writeFileSync(DATA_FILE, JSON.stringify(snapshot), "utf8");
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("cleaning-attendance", snapshot));
  } catch (e) {
    console.warn("[attendance] persist failed:", e);
  }
}

load();

export function addPunch(input: Omit<AttendancePunch, "id" | "at">): AttendancePunch {
  load();
  const p: AttendancePunch = { ...input, id: `at_${randomBytes(8).toString("hex")}`, at: new Date().toISOString() };
  punches.push(p);
  persist();
  return p;
}

export function punchesForTask(taskId: string): AttendancePunch[] {
  load();
  return punches.filter((p) => p.taskId === taskId);
}

export function punchesForHost(hostId: string): AttendancePunch[] {
  load();
  return punches.filter((p) => p.hostId === hostId);
}
