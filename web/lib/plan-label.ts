import type { TFn } from "@/lib/i18n";

/**
 * Traduce la etiqueta de un plan del catálogo («Verificación de identidad · 6 meses»):
 * el nombre y el plazo por separado, porque el plazo se agrega al vuelo.
 */
export function translatePlanLabel(label: string, t: TFn): string {
  const m = /^(.*?)\s*·\s*(\d+)\s*mes(es)?$/i.exec(label.trim());
  if (!m) return t(label);
  return `${t(m[1])} · ${t(m[3] ? "{n} meses" : "{n} mes", { n: m[2] })}`;
}
