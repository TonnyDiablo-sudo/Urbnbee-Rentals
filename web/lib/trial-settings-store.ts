import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";
import { DEFAULT_TRIAL_DAYS, TRIAL_DAY_OPTIONS, type TrialDays } from "@/lib/tool-trial";

/**
 * Lo que decide el admin sobre la prueba gratis de las herramientas (limpieza, colaboradores y
 * verificación de dirección): si se ofrece a quien nunca la ha probado y cuántos días dura.
 */
export type TrialSettings = {
  enabled: boolean;
  days: TrialDays;
  updatedAt?: string;
};

const DATA_FILE = join(getDataDir(), "trial-settings.json");
let cache: TrialSettings | null = null;
let cachedMtimeMs = 0;

function defaults(): TrialSettings {
  return { enabled: true, days: DEFAULT_TRIAL_DAYS };
}

function daysOf(v: unknown): TrialDays {
  const n = Number(v);
  return (TRIAL_DAY_OPTIONS as readonly number[]).includes(n) ? (n as TrialDays) : DEFAULT_TRIAL_DAYS;
}

function load(): TrialSettings {
  try {
    if (!existsSync(DATA_FILE)) return (cache ??= defaults());
    const m = statSync(DATA_FILE).mtimeMs;
    if (cache && m === cachedMtimeMs) return cache;
    const raw = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Partial<TrialSettings>;
    cache = {
      enabled: typeof raw.enabled === "boolean" ? raw.enabled : true,
      days: daysOf(raw.days),
      updatedAt: raw.updatedAt,
    };
    cachedMtimeMs = m;
  } catch (e) {
    console.warn("[trial-settings] load failed:", e);
    cache ??= defaults();
  }
  return cache;
}

export function trialSettings(): TrialSettings {
  return load();
}

/** ¿Se ofrece la prueba gratis a quien nunca la ha usado? */
export function trialEnabled(): boolean {
  return load().enabled;
}

/** Días que dura la prueba gratis (30 o 60, según el admin). */
export function trialDays(): TrialDays {
  return load().days;
}

export function saveTrialSettings(input: { enabled?: unknown; days?: unknown }): TrialSettings {
  const prev = load();
  const next: TrialSettings = {
    enabled: typeof input.enabled === "boolean" ? input.enabled : prev.enabled,
    days: input.days !== undefined ? daysOf(input.days) : prev.days,
    updatedAt: new Date().toISOString(),
  };
  try {
    ensureDir(getDataDir());
    writeFileSync(DATA_FILE, JSON.stringify(next, null, 2), "utf8");
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    cache = next;
    scheduleMysql(() => upsertJsonBlob("trial-settings", next));
  } catch (e) {
    console.warn("[trial-settings] persist failed:", e);
  }
  return next;
}
