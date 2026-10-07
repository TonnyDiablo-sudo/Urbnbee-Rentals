/** Idiomas del traductor del chat (código ISO → nombre en su idioma y nombre en inglés para el modelo). */
export const CHAT_LANGS: { code: string; name: string; english: string }[] = [
  { code: "es", name: "Español", english: "Spanish" },
  { code: "en", name: "English", english: "English" },
  { code: "fr", name: "Français", english: "French" },
  { code: "pt", name: "Português", english: "Portuguese" },
  { code: "de", name: "Deutsch", english: "German" },
  { code: "it", name: "Italiano", english: "Italian" },
  { code: "nl", name: "Nederlands", english: "Dutch" },
  { code: "ru", name: "Русский", english: "Russian" },
  { code: "zh", name: "中文", english: "Chinese (Simplified)" },
  { code: "ja", name: "日本語", english: "Japanese" },
  { code: "ko", name: "한국어", english: "Korean" },
  { code: "ar", name: "العربية", english: "Arabic" },
  { code: "he", name: "עברית", english: "Hebrew" },
  { code: "hi", name: "हिन्दी", english: "Hindi" },
];

/** Código de idioma del chat válido (sin "auto"). */
export function isChatLang(v: unknown): v is string {
  return typeof v === "string" && CHAT_LANGS.some((l) => l.code === v);
}

export function chatLangEnglishName(code: string): string {
  return CHAT_LANGS.find((l) => l.code === code)?.english ?? code;
}

/** "auto" = al idioma en que escribe la otra persona. */
export type ChatTranslateTarget = "auto" | (typeof CHAT_LANGS)[number]["code"];

export function isChatTranslateTarget(v: unknown): v is ChatTranslateTarget {
  return v === "auto" || (typeof v === "string" && CHAT_LANGS.some((l) => l.code === v));
}

export function chatLangName(code: string): string {
  return CHAT_LANGS.find((l) => l.code === code)?.name ?? code;
}
