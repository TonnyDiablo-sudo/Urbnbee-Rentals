import "server-only";
import { CHAT_LANGS, type ChatTranslateTarget } from "@/lib/chat-langs";
import { translationEnabled } from "@/lib/content-translate";
import { callListingImportOpenAiJson } from "@/lib/listing-import-openai";

/**
 * Traductor del chat (membresía con identidad verificada): quien escribe manda su mensaje ya traducido
 * al idioma de la otra persona; el texto tal cual lo escribió se guarda en `original`.
 */

const LANG_NAME: Record<string, string> = {
  es: "Spanish",
  en: "English",
  fr: "French",
  pt: "Portuguese",
  de: "German",
  it: "Italian",
  nl: "Dutch",
  ru: "Russian",
  zh: "Chinese (Simplified)",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
  he: "Hebrew",
  hi: "Hindi",
};

const MODEL = () => process.env.CONTENT_TRANSLATE_MODEL?.trim() || "gpt-4o-mini";
const DETECT_TTL_MS = 10 * 60_000;
const detected = new Map<string, { lang: string | null; at: number }>();

export function chatTranslatorEnabled(): boolean {
  return translationEnabled();
}

/** Idioma predominante de unos textos (código ISO de la lista del chat) o null si no se pudo. */
export async function detectChatLanguage(texts: string[], cacheKey?: string): Promise<string | null> {
  const sample = texts.map((t) => t.trim()).filter((t) => /\p{L}{2}/u.test(t)).slice(-6);
  if (!sample.length || !translationEnabled()) return null;
  const hit = cacheKey ? detected.get(cacheKey) : undefined;
  if (hit && Date.now() - hit.at < DETECT_TTL_MS) return hit.lang;
  const codes = CHAT_LANGS.map((l) => l.code);
  const r = await callListingImportOpenAiJson<{ lang?: unknown }>({
    system: [
      "You detect the language people write in a short chat.",
      `Answer with JSON {"lang": code} where code is one of: ${codes.join(", ")}.`,
      "Pick the language most of the latest messages are written in. If none fits, use the closest one.",
    ].join(" "),
    userText: JSON.stringify({ messages: sample }),
    maxTokens: 30,
    timeoutMs: 8_000,
    model: MODEL(),
  });
  const lang = r.ok && typeof r.data.lang === "string" && codes.includes(r.data.lang) ? r.data.lang : null;
  if (cacheKey) detected.set(cacheKey, { lang, at: Date.now() });
  return lang;
}

export type OutgoingTranslation = {
  /** Lo que recibe la otra persona. */
  body: string;
  /** Lo que escribió quien manda, sólo si se tradujo. */
  original?: string;
  /** Idioma en que quedó `body`, si se tradujo. */
  lang?: string;
};

/**
 * Traduce lo que alguien va a mandar. Con `auto` se usa el idioma de los últimos mensajes de la otra
 * persona (`otherTexts`); si no hay, `fallbackTexts` (p. ej. el anuncio). Si algo falla, el mensaje
 * sale tal cual: nunca se pierde.
 */
export async function translateOutgoing(
  text: string,
  target: ChatTranslateTarget,
  ctx: { otherTexts: string[]; fallbackTexts?: string[]; cacheKey: string }
): Promise<OutgoingTranslation> {
  if (!translationEnabled() || !/\p{L}{2}/u.test(text)) return { body: text };
  let lang: string | null = target;
  if (target === "auto") {
    lang = await detectChatLanguage(ctx.otherTexts, `${ctx.cacheKey}:other`);
    if (!lang && ctx.fallbackTexts?.length) lang = await detectChatLanguage(ctx.fallbackTexts, `${ctx.cacheKey}:fallback`);
  }
  if (!lang) return { body: text };
  const name = LANG_NAME[lang] ?? lang;
  const r = await callListingImportOpenAiJson<{ t?: unknown }>({
    system: [
      `You translate chat messages between a vacation-rental host and a guest into ${name}.`,
      "Translate naturally, keeping the tone, line breaks, emojis, numbers, prices, dates, times, addresses, emails, URLs and names exactly as they are.",
      `If the message is already in ${name}, return it unchanged. Never add explanations.`,
      'Respond with JSON: {"t": "translated message"}.',
    ].join(" "),
    userText: JSON.stringify({ message: text }),
    maxTokens: Math.min(4_000, text.length * 2 + 200),
    timeoutMs: 15_000,
    model: MODEL(),
  });
  const out = r.ok && typeof r.data.t === "string" ? r.data.t.trim() : "";
  if (!out || out === text.trim()) return { body: text };
  return { body: out.slice(0, 2_000), original: text, lang };
}
