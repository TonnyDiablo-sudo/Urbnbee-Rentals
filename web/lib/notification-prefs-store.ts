import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { ALARM_CATEGORY_IDS, type AlarmCategory } from "@/lib/alarm-categories";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

/** Sólo se guarda lo apagado: quien nunca abrió su centro de alarmas recibe todo. */
type Data = { version: 1; off: Record<string, AlarmCategory[]> };

const DATA_FILE = join(getDataDir(), "notification-prefs.json");
let cache: Data = { version: 1, off: {} };
let cachedMtimeMs = -1;

function load(): Data {
  try {
    if (!existsSync(DATA_FILE)) return cache;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return cache;
    const raw = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Partial<Data>;
    cache = { version: 1, off: raw.off && typeof raw.off === "object" ? raw.off : {} };
    cachedMtimeMs = m;
  } catch (e) {
    console.warn("[notification-prefs] load failed:", e);
  }
  return cache;
}

export function alarmsOff(userId: string): AlarmCategory[] {
  return load().off[userId] ?? [];
}

export function alarmOn(userId: string, category: AlarmCategory): boolean {
  return !alarmsOff(userId).includes(category);
}

/** `category: "all"` prende o apaga todos los grupos a la vez. */
export function setAlarm(userId: string, category: AlarmCategory | "all", on: boolean): AlarmCategory[] {
  if (category !== "all" && !ALARM_CATEGORY_IDS.includes(category)) return alarmsOff(userId);
  const data = load();
  const cur = new Set(data.off[userId] ?? []);
  for (const c of category === "all" ? ALARM_CATEGORY_IDS : [category]) {
    if (on) cur.delete(c);
    else cur.add(c);
  }
  const next = ALARM_CATEGORY_IDS.filter((c) => cur.has(c));
  const off = { ...data.off };
  if (next.length) off[userId] = next;
  else delete off[userId];
  cache = { version: 1, off };
  try {
    ensureDir(getDataDir());
    writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2), "utf8");
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    const snapshot = cache;
    scheduleMysql(() => upsertJsonBlob("notification-prefs", snapshot));
  } catch (e) {
    console.warn("[notification-prefs] persist failed:", e);
  }
  return next;
}
