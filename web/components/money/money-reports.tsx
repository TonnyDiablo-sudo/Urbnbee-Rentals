import Link from "next/link";
import { spendingRows, spendingSummary, spendingYears } from "@/lib/guest-spending-report";
import { EarningsDownload } from "@/components/money/earnings-download";
import { STATUS_LABEL, earningsRows, earningsSummary, earningsYears } from "@/lib/host-earnings-report";
import { numberLocale, type Lang, type TFn } from "@/lib/i18n";

const mxn = (n: number) => `$${n.toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN`;

function day(iso: string, lang: Lang): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(numberLocale(lang), { day: "numeric", month: "short", year: "numeric" });
}

function YearChips({ years, year, basePath, t }: { years: number[]; year: number | null; basePath: string; t: TFn }) {
  const chip = (on: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-sm ${on ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] bg-white text-[#222]"}`;
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {years.map((y) => (
        <Link key={y} href={`${basePath}?anio=${y}`} className={chip(year === y)} scroll={false}>
          {y}
        </Link>
      ))}
      <Link href={`${basePath}?anio=todos`} className={chip(year === null)} scroll={false}>
        {t("Todos")}
      </Link>
    </div>
  );
}

function Stat({ value, label, dark }: { value: string; label: string; dark?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${dark ? "bg-[#111] text-white" : "border border-[#ebebeb] bg-white"}`}>
      <p className={`break-words text-lg font-bold sm:text-2xl ${dark ? "text-[#dcb81e]" : "text-[#222]"}`}>{value}</p>
      <p className={`text-xs ${dark ? "text-white/70" : "text-[#717171]"}`}>{label}</p>
    </div>
  );
}

function CsvButton({ href, t }: { href: string; t: TFn }) {
  return (
    <a href={href} download className="inline-flex items-center justify-center rounded-xl bg-[#222] px-4 py-3 text-sm font-semibold text-white">
      {t("Exportar a CSV")}
    </a>
  );
}

function parseYear(raw: string | undefined, years: number[]): number | null {
  if (raw === "todos") return null;
  if (raw && /^\d{4}$/.test(raw)) return Number(raw);
  return years[0] ?? new Date().getFullYear();
}

const PAY_METHOD: Record<string, string> = { stripe: "Tarjeta", clabe: "Transferencia", zelle: "Zelle", cashapp: "Cash App", oxxo: "Oxxo" };

function monthName(i: number, lang: Lang, style: "long" | "short" | "narrow" = "long"): string {
  return new Date(2000, i, 1).toLocaleDateString(numberLocale(lang), { month: style }).replace(/\.$/, "");
}

/** Pagos recibidos del anfitrión: su reporte de ingresos (para el contador, el SAT o el IRS). */
export function EarningsReport({
  hostId,
  yearParam,
  monthParam,
  basePath,
  detailsBase,
  t,
  lang,
}: {
  hostId: string;
  yearParam?: string;
  monthParam?: string;
  basePath: string;
  detailsBase: string;
  t: TFn;
  lang: Lang;
}) {
  const years = earningsYears(hostId);
  const year = parseYear(yearParam, years);
  const yearRows = earningsRows(hostId, year);
  const m = Number(monthParam);
  const month = year !== null && Number.isInteger(m) && m >= 1 && m <= 12 ? m : null;
  const rows = month ? yearRows.filter((r) => Number(r.checkIn.slice(5, 7)) === month) : yearRows;
  const sum = earningsSummary(rows);
  const collected = rows.reduce((n, r) => n + r.collectedMxn, 0);
  const refunded = rows.reduce((n, r) => n + r.refundedMxn, 0);
  const months = Array.from({ length: 12 }, (_, i) => {
    const list = yearRows.filter((r) => Number(r.checkIn.slice(5, 7)) === i + 1);
    return { i, v: list.reduce((n, r) => n + r.netMxn, 0), count: earningsSummary(list).bookings };
  });
  const max = Math.max(1, ...months.map((x) => x.v));
  const best = months.reduce((a, b) => (b.v > a.v ? b : a), months[0]);
  const byListing = [...rows.reduce((map, r) => map.set(r.listingTitle, (map.get(r.listingTitle) ?? 0) + r.netMxn), new Map<string, number>())]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const listingMax = Math.max(1, ...byListing.map(([, v]) => v));
  const href = (mm: number | null) => `${basePath}?anio=${year ?? "todos"}${mm ? `&mes=${mm}` : ""}`;
  const periodLabel = year === null ? t("Todos los años") : month ? `${monthName(month - 1, lang)} ${year}` : String(year);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <YearChips years={years} year={year} basePath={basePath} t={t} />

      <section className="rounded-2xl bg-[#111] p-5 text-white">
        <p className="text-xs uppercase tracking-wide text-white/60 first-letter:uppercase">{periodLabel}</p>
        <p className="mt-1 break-words text-3xl font-bold text-[#dcb81e] sm:text-4xl">{mxn(sum.netMxn)}</p>
        <p className="text-sm text-white/70">{t("Ingreso neto")}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
          <div>
            <p className="text-lg font-semibold">{sum.bookings}</p>
            <p className="text-[11px] text-white/60">{t("Reservas")}</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{sum.nights}</p>
            <p className="text-[11px] text-white/60">{t("Noches")}</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{sum.nights ? mxn(Math.round(sum.netMxn / sum.nights)).replace(" MXN", "") : "—"}</p>
            <p className="text-[11px] text-white/60">{t("Promedio por noche")}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={mxn(collected)} label={t("Cobrado")} />
        <Stat value={refunded > 0 ? `−${mxn(refunded)}` : mxn(0)} label={t("Devuelto")} />
        <Stat value={mxn(sum.taxMxn)} label={t("Impuestos cobrados")} />
        <Stat value={sum.bookings ? mxn(Math.round(sum.netMxn / sum.bookings)) : "—"} label={t("Promedio por reserva")} />
      </div>

      {year !== null && yearRows.length > 0 && (
        <section className="rounded-2xl border border-[#ebebeb] bg-white p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-[#222]">{t("Por mes (fecha de llegada)")}</p>
            {best.v > 0 && (
              <p className="text-xs text-[#717171]">{t("Mejor mes: {month}", { month: monthName(best.i, lang) })}</p>
            )}
          </div>
          <div className="mt-3 flex h-32 items-end gap-1 sm:gap-1.5">
            {months.map((x) => {
              const on = month === x.i + 1;
              return (
                <Link
                  key={x.i}
                  href={href(on ? null : x.i + 1)}
                  scroll={false}
                  aria-label={`${monthName(x.i, lang)}: ${mxn(x.v)}`}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                >
                  <div
                    className={`w-full rounded-t ${on ? "bg-[#111]" : x.v > 0 ? "bg-[#dcb81e]" : "bg-[#eee]"}`}
                    style={{ height: `${Math.max(3, (x.v / max) * 100)}%` }}
                    title={mxn(x.v)}
                  />
                  <span className={`text-[10px] ${on ? "font-bold text-[#222]" : "text-[#999]"}`}>{monthName(x.i, lang, "narrow")}</span>
                </Link>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[#999]">{t("Toca un mes para ver sólo sus reservas.")}</p>
          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            <Link
              href={href(null)}
              scroll={false}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs ${month === null ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] text-[#222]"}`}
            >
              {t("Todo el año")}
            </Link>
            {months
              .filter((x) => x.count > 0 || x.v > 0)
              .map((x) => (
                <Link
                  key={x.i}
                  href={href(x.i + 1)}
                  scroll={false}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs first-letter:uppercase ${month === x.i + 1 ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] text-[#222]"}`}
                >
                  {monthName(x.i, lang, "short")} · {mxn(x.v).replace(" MXN", "")}
                </Link>
              ))}
          </div>
        </section>
      )}

      {byListing.length > 1 && (
        <section className="rounded-2xl border border-[#ebebeb] bg-white p-4">
          <p className="text-sm font-semibold text-[#222]">{t("Por anuncio")}</p>
          <ul className="mt-3 space-y-2.5">
            {byListing.map(([title, v]) => (
              <li key={title}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-[#333]">{title}</span>
                  <span className="shrink-0 font-semibold text-[#222]">{mxn(v)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-[#f1f1f1]">
                  <div className="h-full rounded-full bg-[#dcb81e]" style={{ width: `${(v / listingMax) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <EarningsDownload key={`${year}-${month}`} years={years} year={year} month={month} t={t} lang={lang} />

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-[#f7f7f7] px-4 py-6 text-center text-sm text-[#717171]">{t("Aún no hay pagos en este periodo.")}</p>
      ) : (
        <section>
          <p className="mb-2 text-sm font-semibold text-[#222]">
            {t("Reservas")} · <span className="first-letter:uppercase">{periodLabel}</span>
          </p>
          <ul className="divide-y divide-[#f0f0f0] rounded-2xl border border-[#ebebeb] bg-white">
            {[...rows].reverse().map((r) => (
              <li key={r.id}>
                <Link href={`${detailsBase}/${encodeURIComponent(r.id)}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#fafafa]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5f5f5] text-sm font-bold text-[#555]">
                    {r.guestName.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-[#222]">{r.guestName}</p>
                    <p className="truncate text-xs text-[#717171]">
                      {r.listingTitle} · {day(r.checkIn, lang)} · {r.nights} {r.nights === 1 ? t("noche") : t("noches")}
                    </p>
                    <p className="text-xs text-[#999]">
                      {r.paidAt ? t("Pagado el {date}", { date: day(r.paidAt, lang) }) : t(STATUS_LABEL[r.status])}
                      {r.method ? ` · ${t(PAY_METHOD[r.method] ?? r.method)}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-[15px] font-semibold ${r.netMxn > 0 ? "text-[#1e7a3a]" : "text-[#888]"}`}>{mxn(r.netMxn)}</p>
                    {r.refundedMxn > 0 && <p className="text-xs text-red-700">−{mxn(r.refundedMxn)}</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-[#999]">
        {t("Cuenta las reservas pagadas o confirmadas, por fecha de llegada. El neto ya descuenta devoluciones; no incluye el cargo de servicio de Cabibee, que paga el huésped.")}
      </p>
    </div>
  );
}

/** Gastos del huésped: cuánto ha pagado en Cabibee y en qué. */
export function SpendingReport({
  userId,
  yearParam,
  basePath,
  detailsBase,
  t,
  lang,
}: {
  userId: string;
  yearParam?: string;
  basePath: string;
  detailsBase: string;
  t: TFn;
  lang: Lang;
}) {
  const years = spendingYears(userId);
  const year = parseYear(yearParam, years);
  const rows = spendingRows(userId, year);
  const sum = spendingSummary(rows);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <YearChips years={years} year={year} basePath={basePath} t={t} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat dark value={mxn(sum.netMxn)} label={t("Gasto neto")} />
        <Stat value={mxn(sum.paidMxn)} label={t("Pagado")} />
        <Stat value={String(sum.trips)} label={t("Viajes")} />
        <Stat value={String(sum.nights)} label={t("Noches")} />
      </div>
      {sum.refundedMxn > 0 && <p className="text-sm text-[#555]">{t("Te devolvieron: {amount}", { amount: mxn(sum.refundedMxn) })}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <CsvButton href={`/api/guest/spending-csv?year=${year ?? "todos"}`} t={t} />
        <p className="text-xs text-[#888]">{t("Para tus gastos de viaje o de trabajo.")}</p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-[#f7f7f7] px-4 py-6 text-center text-sm text-[#717171]">{t("Aún no hay pagos en este periodo.")}</p>
      ) : (
        <ul className="divide-y divide-[#f0f0f0] rounded-2xl border border-[#ebebeb] bg-white">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`${detailsBase}/${encodeURIComponent(r.id)}`} className="flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-[#222]">{r.listingTitle}</p>
                  <p className="truncate text-xs text-[#717171]">
                    {day(r.checkIn, lang)} – {day(r.checkOut, lang)} · {r.nights} {r.nights === 1 ? t("noche") : t("noches")}
                  </p>
                  <p className="text-xs text-[#999]">
                    {t("Pagado el {date}", { date: day(r.paidAt, lang) })}
                    {r.method ? ` · ${t(r.method)}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[15px] font-semibold text-[#222]">{mxn(r.netMxn)}</p>
                  {r.refundedMxn > 0 && <p className="text-xs text-[#1e7a3a]">+{mxn(r.refundedMxn)} {t("devuelto")}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-[#999]">{t("Incluye la estancia, la limpieza, los impuestos y el cargo de servicio. Las devoluciones ya están descontadas.")}</p>
    </div>
  );
}
