import { numberLocale, type Lang, type TVars } from "@/lib/i18n";

const DAY = /^(?:@day:)?(\d{4})-(\d{2})-(\d{2})((?: · \d{2}:\d{2})?)$/;

/** Fecha para `vars` de una notificación: se guarda neutra y se escribe en el idioma de quien la lee. Un «AAAA-MM-DD» suelto también se escribe así. */
export function dayVar(day: string, time?: string): string {
  return `@day:${day}${time ? ` · ${time}` : ""}`;
}

export function localizeVars(vars: TVars | undefined, lang: Lang): TVars | undefined {
  if (!vars) return vars;
  let out: TVars | undefined;
  for (const [k, v] of Object.entries(vars)) {
    const m = typeof v === "string" ? DAY.exec(v) : null;
    if (!m) continue;
    const day = new Intl.DateTimeFormat(numberLocale(lang), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
    );
    out = { ...(out ?? vars), [k]: day + m[4] };
  }
  return out ?? vars;
}
