import "server-only";
import { createHash } from "crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { getEffectiveBlogBotApiKey } from "@/lib/blog-bot-store";
import { chatLangEnglishName } from "@/lib/chat-langs";
import type { Lang } from "@/lib/i18n";
import { callListingImportOpenAiJson } from "@/lib/listing-import-openai";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

/**
 * Traducción automática de lo que escriben las personas (anuncios, reseñas, contratos, guía de llegada).
 * Cada texto se traduce una sola vez por idioma y queda guardado; si todavía no está, se muestra el
 * original y la traducción sigue en segundo plano para la próxima vez.
 */

const LANG_NAME: Record<string, string> = { es: "Spanish (Mexico)", en: "English (US)" };
/** Idioma de destino: los dos del sitio (`Lang`) o cualquiera del traductor del chat. */
export type TranslateLang = Lang | string;
function langName(lang: string): string {
  return LANG_NAME[lang] ?? chatLangEnglishName(lang);
}
const MAX_ENTRIES = 40_000;
const MAX_TEXT = 6_000;
const CHUNK_CHARS = 7_000;
const CHUNK_ITEMS = 60;
const RETRY_AFTER_MS = 10 * 60_000;

type Entry = { t: string; at: string };

const DATA_FILE = join(getDataDir(), "content-translations.json");
let entries: Record<string, Entry> = {};
let cachedMtimeMs = 0;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const inflight = new Map<string, Promise<void>>();
const failedAt = new Map<string, number>();

function load() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { entries?: Record<string, Entry> };
    entries = data.entries && typeof data.entries === "object" ? data.entries : {};
    cachedMtimeMs = m;
  } catch (e) {
    console.warn("[translate] load failed:", e);
  }
}

function persistSoon() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const keys = Object.keys(entries);
      if (keys.length > MAX_ENTRIES) {
        keys
          .sort((a, b) => entries[a].at.localeCompare(entries[b].at))
          .slice(0, keys.length - MAX_ENTRIES)
          .forEach((k) => delete entries[k]);
      }
      ensureDir(getDataDir());
      const snapshot = { version: 1 as const, entries };
      writeFileSync(DATA_FILE, JSON.stringify(snapshot), "utf8");
      cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
      scheduleMysql(() => upsertJsonBlob("content-translations", snapshot));
    } catch (e) {
      console.warn("[translate] persist failed:", e);
    }
  }, 400);
}

load();

const keyOf = (text: string, lang: string) => `${lang}:${createHash("sha1").update(text).digest("base64url")}`;

const ES_WORDS = /\b(el|la|los|las|de|del|que|y|en|con|para|por|una|un|es|está|muy|tiene|cerca|casa|habitación|baño|cocina|no|se|al|su|tu|hay)\b/gi;
const EN_WORDS = /\b(the|and|of|to|with|for|is|in|a|an|you|your|this|near|room|house|bathroom|kitchen|not|it|on|are|has|our|we)\b/gi;

/** Adivina si el texto ya está en ese idioma; con textos muy cortos (u otros idiomas) no se arriesga. */
function alreadyIn(text: string, lang: string): boolean {
  if (!/\p{L}/u.test(text)) return true;
  if (lang !== "es" && lang !== "en") return false;
  const es = (text.match(ES_WORDS) ?? []).length + (/[ñ¿¡áéíóú]/i.test(text) ? 2 : 0);
  const en = (text.match(EN_WORDS) ?? []).length;
  if (es + en < 2) return false;
  return lang === "es" ? es > en * 1.5 : en > es * 1.5;
}

export function translationEnabled(): boolean {
  return Boolean(getEffectiveBlogBotApiKey());
}

async function translateChunk(texts: string[], lang: string): Promise<void> {
  const name = langName(lang);
  const r = await callListingImportOpenAiJson<{ t?: unknown }>({
    system: [
      `You translate user-written content of a vacation-rental marketplace into ${name}.`,
      "Translate each item faithfully and naturally. Keep line breaks, bullet points, emojis, numbers, prices, dates, times, emails, URLs and names of people and places exactly as they are.",
      `If an item is already in ${name}, return it unchanged. Never add explanations.`,
      'Respond with JSON: {"t": [translated items, same order and same count]}.',
    ].join(" "),
    userText: JSON.stringify({ items: texts }),
    maxTokens: Math.min(12_000, Math.ceil(texts.reduce((n, s) => n + s.length, 0) / 2) + 800),
    timeoutMs: 60_000,
    model: process.env.CONTENT_TRANSLATE_MODEL?.trim() || "gpt-4o-mini",
  });
  const out = r.ok && Array.isArray(r.data.t) ? r.data.t : null;
  const now = new Date().toISOString();
  texts.forEach((text, i) => {
    const key = keyOf(text, lang);
    const v = out?.[i];
    if (typeof v === "string" && v.trim()) {
      entries[key] = { t: v, at: now };
      failedAt.delete(key);
    } else {
      failedAt.set(key, Date.now());
    }
  });
  if (!r.ok) console.warn("[translate] failed:", r.error);
  persistSoon();
}

/**
 * Traduce al idioma `lang`. Espera hasta `waitMs` a las que falten; las que no lleguen a tiempo
 * se devuelven en el original y se guardan cuando terminen.
 */
export async function translateTexts(texts: string[], lang: TranslateLang, opts: { waitMs?: number } = {}): Promise<string[]> {
  load();
  const enabled = translationEnabled();
  const pending: Promise<void>[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const raw of texts) {
    const text = raw?.trim() ? raw : "";
    if (!text || text.length > MAX_TEXT || alreadyIn(text, lang)) continue;
    const key = keyOf(text, lang);
    if (entries[key] || seen.has(key)) continue;
    seen.add(key);
    const busy = inflight.get(key);
    if (busy) pending.push(busy);
    else if (enabled && Date.now() - (failedAt.get(key) ?? 0) > RETRY_AFTER_MS) missing.push(text);
  }

  let chunk: string[] = [];
  let size = 0;
  const flush = () => {
    if (!chunk.length) return;
    const items = chunk;
    const p = translateChunk(items, lang)
      .catch((e) => console.warn("[translate] chunk error:", e))
      .finally(() => items.forEach((s) => inflight.delete(keyOf(s, lang))));
    items.forEach((s) => inflight.set(keyOf(s, lang), p));
    pending.push(p);
    chunk = [];
    size = 0;
  };
  for (const text of missing) {
    if (chunk.length >= CHUNK_ITEMS || size + text.length > CHUNK_CHARS) flush();
    chunk.push(text);
    size += text.length;
  }
  flush();

  const wait = opts.waitMs ?? 0;
  if (pending.length && wait > 0) {
    await Promise.race([Promise.allSettled(pending), new Promise((r) => setTimeout(r, wait))]);
  }
  return texts.map((text) => (text?.trim() ? (entries[keyOf(text, lang)]?.t ?? text) : text));
}

/** Traduce los campos de texto indicados de un objeto (devuelve una copia). */
export async function translateFields<T extends object>(
  obj: T,
  fields: (keyof T)[],
  lang: TranslateLang,
  opts: { waitMs?: number } = {}
): Promise<T> {
  const values = fields.map((f) => (typeof obj[f] === "string" ? (obj[f] as string) : ""));
  const out = await translateTexts(values, lang, opts);
  const copy = { ...obj };
  fields.forEach((f, i) => {
    if (values[i]) (copy as Record<keyof T, unknown>)[f] = out[i];
  });
  return copy;
}
