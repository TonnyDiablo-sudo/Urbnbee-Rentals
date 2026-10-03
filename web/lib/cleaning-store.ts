import "server-only";
import { randomBytes } from "crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

export type CleaningStatus = "pending" | "done" | "cancelled";

/** "host" = el anfitrión mismo; si no, el id del miembro del equipo. */
export type CleaningAssignee = "host" | string;

export type CleaningPhoto = { id: string; key: string; by: string; at: string };

/** CÃ³mo trabaja cada anfitriÃ³n su limpieza. */
export type CleaningSettings = {
  /** auto: cada limpieza nueva va a quien limpia ese anuncio; manual: el anfitriÃ³n elige. */
  assignMode: "auto" | "manual";
  /** Pedir al menos una foto para marcarla como hecha. */
  requirePhoto: boolean;
};

export const DEFAULT_CLEANING_SETTINGS: CleaningSettings = { assignMode: "auto", requirePhoto: false };

export type CleaningTask = {
  id: string;
  hostId: string;
  listingId: string;
  /** Reserva que la generó; las tareas manuales no tienen. */
  bookingId?: string;
  /** Día de la limpieza (YYYY-MM-DD, hora de México): el día de salida. */
  date: string;
  /** Próxima llegada al mismo anuncio, para saber cuánto tiempo hay. */
  nextCheckIn?: string;
  guestName?: string;
  assignee?: CleaningAssignee;
  status: CleaningStatus;
  note?: string;
  doneAt?: string;
  doneBy?: string;
  remindedAt?: string;
  photos?: CleaningPhoto[];
  createdAt: string;
  updatedAt: string;
};

const DATA_FILE = join(getDataDir(), "cleaning-tasks.json");
let tasks: CleaningTask[] = [];
/** Quién limpia cada anuncio por defecto, por anuncio. */
let defaults: Record<string, CleaningAssignee> = {};
let settings: Record<string, CleaningSettings> = {};
let cachedMtimeMs = 0;

function load() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as {
      tasks?: CleaningTask[];
      defaults?: Record<string, CleaningAssignee>;
      settings?: Record<string, CleaningSettings>;
    };
    tasks = Array.isArray(data.tasks) ? data.tasks : [];
    defaults = data.defaults && typeof data.defaults === "object" ? data.defaults : {};
    settings = data.settings && typeof data.settings === "object" ? data.settings : {};
    cachedMtimeMs = m;
  } catch (e) {
    console.warn("[cleaning] load failed:", e);
  }
}

function persist() {
  try {
    ensureDir(getDataDir());
    const snapshot = { version: 1 as const, tasks, defaults, settings };
    writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("cleaning-tasks", snapshot));
  } catch (e) {
    console.warn("[cleaning] persist failed:", e);
  }
}

load();

export function listCleaningTasksForHost(hostId: string): CleaningTask[] {
  load();
  return tasks.filter((t) => t.hostId === hostId);
}

export function getCleaningTask(id: string): CleaningTask | undefined {
  load();
  return tasks.find((t) => t.id === id);
}

export function findTaskForBooking(bookingId: string): CleaningTask | undefined {
  load();
  return tasks.find((t) => t.bookingId === bookingId);
}

export function addCleaningTask(input: Omit<CleaningTask, "id" | "createdAt" | "updatedAt" | "status">): CleaningTask {
  load();
  const now = new Date().toISOString();
  const task: CleaningTask = {
    ...input,
    id: `cl_${randomBytes(9).toString("hex")}`,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  tasks.push(task);
  persist();
  return task;
}

export function updateCleaningTask(
  id: string,
  patch: Partial<Omit<CleaningTask, "id" | "hostId" | "createdAt">>
): CleaningTask | undefined {
  load();
  const i = tasks.findIndex((t) => t.id === id);
  if (i === -1) return undefined;
  tasks[i] = { ...tasks[i], ...patch, updatedAt: new Date().toISOString() };
  persist();
  return tasks[i];
}

export function deleteCleaningTask(id: string): boolean {
  load();
  const before = tasks.length;
  tasks = tasks.filter((t) => t.id !== id);
  if (tasks.length === before) return false;
  persist();
  return true;
}

export function getListingCleaner(listingId: string): CleaningAssignee | undefined {
  load();
  return defaults[listingId];
}

export function setListingCleaner(listingId: string, assignee: CleaningAssignee | undefined) {
  load();
  if (assignee) defaults[listingId] = assignee;
  else delete defaults[listingId];
  persist();
}

export function cleaningHostIds(): string[] {
  load();
  return [...new Set(tasks.map((t) => t.hostId))];
}

export function getCleaningSettings(hostId: string): CleaningSettings {
  load();
  return { ...DEFAULT_CLEANING_SETTINGS, ...(settings[hostId] ?? {}) };
}

export function setCleaningSettings(hostId: string, patch: Partial<CleaningSettings>): CleaningSettings {
  load();
  settings[hostId] = { ...getCleaningSettings(hostId), ...patch };
  persist();
  return settings[hostId];
}

export function allCleaningTasks(): CleaningTask[] {
  load();
  return tasks;
}
