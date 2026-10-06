import { numberLocale, type Lang, type TFn } from "@/lib/i18n";

/** Descarga de ingresos por año o por un mes del año; también el resumen mes por mes. Funciona sin JavaScript. */
export function EarningsDownload({
  years,
  year,
  month = null,
  t,
  lang,
}: {
  years: number[];
  /** null = todos los años */
  year: number | null;
  /** 1-12 */
  month?: number | null;
  t: TFn;
  lang: Lang;
}) {
  const thisYear = new Date().getFullYear();
  const allYears = [...new Set([thisYear, ...years])].sort((a, b) => b - a);
  const sel = "min-w-0 rounded-xl border border-[#ddd] bg-white px-3 py-2.5 text-sm text-[#222]";
  return (
    <form action="/api/host/stats/bookings-csv" method="get" className="rounded-2xl border border-[#ebebeb] bg-white p-4">
      <p className="text-sm font-semibold text-[#222]">{t("Descargar ingresos")}</p>
      <p className="mt-0.5 text-xs text-[#888]">{t("Elige un año completo o un mes. Abre en Excel, Numbers o Google Sheets.")}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <select name="year" defaultValue={year === null ? "todas" : String(year)} aria-label={t("Año")} className={sel}>
          {allYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
          <option value="todas">{t("Todos los años")}</option>
        </select>
        <select name="month" defaultValue={month ? String(month) : ""} aria-label={t("Mes")} className={sel}>
          <option value="">{t("Todo el año")}</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i + 1}>
              {new Date(2000, i, 1).toLocaleDateString(numberLocale(lang), { month: "long" })}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <button type="submit" name="view" value="bookings" className="rounded-xl bg-[#222] px-4 py-2.5 text-sm font-semibold text-white">
          {t("Reservas del periodo (CSV)")}
        </button>
        <button type="submit" name="view" value="months" className="rounded-xl border border-[#222] px-4 py-2.5 text-sm font-semibold text-[#222]">
          {t("Resumen mes por mes (CSV)")}
        </button>
      </div>
    </form>
  );
}
