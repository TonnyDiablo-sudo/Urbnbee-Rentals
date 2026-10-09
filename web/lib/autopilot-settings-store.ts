import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

/** Topes diarios del piloto automático por página que el admin cambia en /admin/asociados. */
export type AutopilotSettingsDoc = { siteLimits: Record<string, number> };

const DATA_FILE = join(getDataDir(), "autopilot-settings.json");
let doc: AutopilotSettingsDoc = { siteLimits: {} };
let cachedMtimeMs = 0;

function reload() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Partial<AutopilotSettingsDoc>;
    doc = { siteLimits: data.siteLimits && typeof data.siteLimits === "object" ? data.siteLimits : {} };
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[autopilot-settings] load failed:", e);
  }
}

function syncIfStale() {
  try {
    if (existsSync(DATA_FILE) && statSync(DATA_FILE).mtimeMs !== cachedMtimeMs) reload();
  } catch {
    /* ignore */
  }
}

reload();

export function getAutopilotSettingsDoc(): AutopilotSettingsDoc {
  syncIfStale();
  return doc;
}

export function saveAutopilotSiteLimits(siteLimits: Record<string, number>): void {
  syncIfStale();
  doc = { ...doc, siteLimits: { ...siteLimits } };
  try {
    ensureDir(getDataDir());
    writeFileSync(DATA_FILE, JSON.stringify(doc, null, 2), "utf8");
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("autopilot-settings", doc));
  } catch (e) {
    console.warn("[autopilot-settings] persist failed:", e);
  }
}
