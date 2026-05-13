import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import type { BlogBotConfigRecord } from "@/lib/blog-bot-types";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "blog-bot-config.json");

/** API key opcional guardada en disco (alternativa a variables de entorno). */
let storedApiKey: string | undefined;

let cachedRecord: BlogBotConfigRecord | null = null;
let cachedMtimeMs = 0;

export const DEFAULT_BLOG_TOPICS: string[] = [
  "Consejos prácticos para anfitriones en CDMX",
  "Urbnbee AI y comunicación con huéspedes",
  "Precios, temporada alta y calendario",
  "Confianza, verificación y buenas reservas",
  "Experiencia del huésped en Urbnbee",
];

export const DEFAULT_BLOG_BOT_CONFIG: Omit<BlogBotConfigRecord, "updatedAt"> = {
  version: 1,
  enabled: false,
  provider: "openai_compatible",
  apiBaseUrl: "https://api.openai.com/v1",
  chatCompletionsUrl: undefined,
  model: "gpt-4o-mini",
  temperature: 0.75,
  maxTokens: 2200,
  systemPromptAppend:
    "Tono cercano, profesional, en español de México. Enfócate en confianza, anfitriones, huéspedes y tecnología que ayuda a reservar con claridad.",
  brandKeywords: "Urbnbee, Urbnbee AI, alojamientos, reservas, Ciudad de México, anfitriones",
  timeoutMs: 120000,
  topics: [...DEFAULT_BLOG_TOPICS],
  scheduleEnabled: false,
  scheduleTimezone: "America/Mexico_City",
  scheduleDaysOfWeek: [1, 3, 5],
  scheduleTimeLocal: "09:00",
  scheduleLastPublishedDate: undefined,
};

function mergeDefaults(data: Partial<BlogBotConfigRecord> | null): BlogBotConfigRecord {
  const now = new Date().toISOString();
  const topics =
    Array.isArray(data?.topics) && data.topics.length > 0 ? data.topics : DEFAULT_BLOG_BOT_CONFIG.topics;
  const scheduleDays =
    Array.isArray(data?.scheduleDaysOfWeek) && data.scheduleDaysOfWeek.length > 0
      ? data.scheduleDaysOfWeek.filter((d) => d >= 0 && d <= 6)
      : DEFAULT_BLOG_BOT_CONFIG.scheduleDaysOfWeek;
  return {
    ...DEFAULT_BLOG_BOT_CONFIG,
    ...data,
    topics,
    scheduleDaysOfWeek: scheduleDays,
    scheduleTimezone: data?.scheduleTimezone?.trim() || DEFAULT_BLOG_BOT_CONFIG.scheduleTimezone,
    scheduleTimeLocal: data?.scheduleTimeLocal?.trim() || DEFAULT_BLOG_BOT_CONFIG.scheduleTimeLocal,
    version: 1,
    updatedAt: data?.updatedAt ?? now,
  };
}

function persist(record: BlogBotConfigRecord) {
  try {
    ensureDir(getDataDir());
    const payload = {
      config: record,
      apiKey: storedApiKey ?? null,
    };
    writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), "utf8");
    if (existsSync(DATA_FILE)) {
      cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    }
  } catch (e) {
    console.warn("[blog-bot-store] persist failed:", e);
  }
}

function reloadFromDisk() {
  try {
    if (!existsSync(DATA_FILE)) {
      cachedRecord = null;
      storedApiKey = undefined;
      return;
    }
    const raw = readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw) as {
      config?: Partial<BlogBotConfigRecord>;
      apiKey?: string | null;
    };
    cachedRecord = mergeDefaults(data.config ?? null);
    storedApiKey = typeof data.apiKey === "string" && data.apiKey.trim() ? data.apiKey.trim() : undefined;
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[blog-bot-store] load failed:", e);
  }
}

function syncIfStale() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    reloadFromDisk();
  } catch {
    /* ignore */
  }
}

reloadFromDisk();

export function getBlogBotConfig(): BlogBotConfigRecord {
  syncIfStale();
  return cachedRecord ?? mergeDefaults(null);
}

export function patchBlogBotConfig(
  patch: Partial<Omit<BlogBotConfigRecord, "version" | "updatedAt">>,
  opts?: { apiKey?: string | null }
): BlogBotConfigRecord {
  syncIfStale();
  const prev = getBlogBotConfig();
  const next: BlogBotConfigRecord = {
    ...prev,
    ...patch,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  cachedRecord = next;
  if (opts && "apiKey" in opts) {
    if (opts.apiKey === null || opts.apiKey === "") {
      storedApiKey = undefined;
    } else if (typeof opts.apiKey === "string") {
      storedApiKey = opts.apiKey.trim();
    }
  }
  persist(next);
  return next;
}

/** Orden de precedencia: BLOG_BOT_OPENAI_API_KEY → OPENAI_API_KEY → clave en archivo. */
export function getEffectiveBlogBotApiKey(): string | undefined {
  syncIfStale();
  const a = process.env.BLOG_BOT_OPENAI_API_KEY?.trim();
  if (a) return a;
  const b = process.env.OPENAI_API_KEY?.trim();
  if (b) return b;
  return storedApiKey;
}

export function hasStoredApiKey(): boolean {
  syncIfStale();
  return Boolean(storedApiKey);
}

export function maskApiKeyHint(): string | null {
  syncIfStale();
  if (!storedApiKey) return null;
  const k = storedApiKey;
  if (k.length <= 8) return "••••••••";
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}
