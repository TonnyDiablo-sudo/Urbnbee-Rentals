import { EN } from "./en";

export type Lang = "es" | "en";
export type TVars = Record<string, string | number>;
export type TFn = (text: string, vars?: TVars) => string;

export const LANGS: Lang[] = ["es", "en"];
/** Compartida entre cabibee.com y app.cabibee.com (dominio padre). */
export const LANG_COOKIE = "cb_lang";

export function isLang(v: unknown): v is Lang {
  return v === "es" || v === "en";
}

/** Idioma del teléfono/navegador: inglés sólo si lo prefiere antes que el español. */
export function langFromAcceptLanguage(header: string | null | undefined): Lang {
  if (!header) return "es";
  const prefs = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const p of prefs) {
    if (p.tag.startsWith("es")) return "es";
    if (p.tag.startsWith("en")) return "en";
  }
  return "es";
}

function interpolate(text: string, vars?: TVars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/**
 * El texto en español es la clave. Si no hay traducción al inglés se muestra el español,
 * así una cadena olvidada nunca deja la pantalla vacía.
 */
/** Etiquetas compuestas como «Verificación de identidad · 6 meses» se traducen por partes. */
function lookupEn(text: string): string | undefined {
  const hit = EN[text];
  if (hit !== undefined || !text.includes(" · ")) return hit;
  const parts = text.split(" · ");
  return parts.every((p) => EN[p] !== undefined) ? parts.map((p) => EN[p]).join(" · ") : undefined;
}

export function makeT(lang: Lang): TFn {
  if (lang === "es") return (text, vars) => interpolate(text, vars);
  return (text, vars) => interpolate(lookupEn(text) ?? text, vars);
}

/** Formato de números/moneda según idioma. */
export function numberLocale(lang: Lang): string {
  return lang === "en" ? "en-US" : "es-MX";
}
