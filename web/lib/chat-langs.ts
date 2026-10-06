/** Idiomas a los que el traductor del chat puede mandar un mensaje (código ISO → nombre en su idioma). */
export const CHAT_LANGS: { code: string; name: string }[] = [
  { code: "es", name: "Español" },
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
  { code: "pt", name: "Português" },
  { code: "de", name: "Deutsch" },
  { code: "it", name: "Italiano" },
  { code: "nl", name: "Nederlands" },
  { code: "ru", name: "Русский" },
  { code: "zh", name: "中文" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "ar", name: "العربية" },
  { code: "he", name: "עברית" },
  { code: "hi", name: "हिन्दी" },
];

/** "auto" = al idioma en que escribe la otra persona. */
export type ChatTranslateTarget = "auto" | (typeof CHAT_LANGS)[number]["code"];

export function isChatTranslateTarget(v: unknown): v is ChatTranslateTarget {
  return v === "auto" || (typeof v === "string" && CHAT_LANGS.some((l) => l.code === v));
}

export function chatLangName(code: string): string {
  return CHAT_LANGS.find((l) => l.code === code)?.name ?? code;
}
