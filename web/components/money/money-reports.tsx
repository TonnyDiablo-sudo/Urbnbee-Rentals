import Link from "next/link";
import { spendingRows, spendingSummary, spendingYears } from "@/lib/guest-spending-report";
import { earningsRows, earningsSummary, earningsYears } from "@/lib/host-earnings-report";
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

/** Pagos recibidos del anfitrión: su reporte de ingresos (para el contador, el SAT o el IRS). */
export function EarningsReport({
  hostId,
  yearParam,
  basePath,
  detailsBase,
  t,
  lang,
}: {
  hostId: string;
  yearParam?: string;
  basePath: string;
  detailsBase: string;
  t: TFn;
  lang: Lang;
}) {
  const years = earningsYears(hostId);
  const year = parseYear(yearParam, years);
  const rows = earningsRows(hostId, year);
  const sum = earningsSummary(rows);
  const collected = rows.reduce((n, r) => n + r.collectedMxn, 0);
  const refunded = rows.reduce((n, r) => n + r.refundedMxn, 0);
  const months = Array.from({ length: 12 }, (_, i) => ({
    i,
    v: rows.filter((r) => Number(r.checkIn.slice(5, 7)) === i + 1).reduce((n, r) => n + r.netMxn, 0),
  }));
  const max = Math.max(1, ...months.map((m) => m.v));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <YearChips years={years} year={year} basePath={basePath} t={t} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat dark value={mxn(sum.netMxn)} label={t("Ingreso neto")} />
        <Stat value={mxn(collected)} label={t("Cobrado")} />
        <Stat value={String(sum.bookings)} label={t("Reservas")} />
        <Stat value={String(sum.nights)} label={t("Noches")} />
      </div>
      {(refunded > 0 || sum.taxMxn > 0) && (
        <p className="text-sm text-[#555]">
          {[
            refunded > 0 ? t("Devuelto: {amount}", { amount: mxn(refunded) }) : "",
            sum.taxMxn > 0 ? t("Impuestos cobrados: {amount}", { amount: mxn(sum.taxMxn) }) : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      {year !== null && rows.length > 0 && (
        <section className="rounded-2xl border border-[#ebebeb] bg-white p-4">
          <p className="text-sm font-semibold text-[#222]">{t("Por mes (fecha de llegada)")}</p>
          <div className="mt-3 flex h-28 items-end gap-1 sm:gap-1.5">
            {months.map((m) => (
              <div key={m.i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div
                  className={`w-full rounded-t ${m.v > 0 ? "bg-[#dcb81e]" : "bg-[#eee]"}`}
                  style={{ height: `${Math.max(3, (m.v / max) * 100)}%` }}
                  title={mxn(m.v)}
                />
                <span className="text-[10px] text-[#999]">{new Date(2000, m.i, 1).toLocaleDateString(numberLocale(lang), { month: "narrow" })}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <CsvButton href={`/api/host/stats/bookings-csv?year=${year ?? "todas"}`} t={t} />
        <p className="text-xs text-[#888]">{t("Abre en Excel, Numbers o Google Sheets. Sirve para tu contador.")}</p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-[#f7f7f7] px-4 py-6 text-center text-sm text-[#717171]">{t("Aún no hay pagos en este periodo.")}</p>
      ) : (
        <ul className="divide-y divide-[#f0f0f0] rounded-2xl border border-[#ebebeb] bg-white">
          {[...rows].reverse().map((r) => (
            <li key={r.id}>
              <Link href={`${detailsBase}/${encodeURIComponent(r.id)}`} className="flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-[#222]">{r.guestName}</p>
                  <p className="truncate text-xs text-[#717171]">
                    {r.listingTitle} · {day(r.checkIn, lang)} · {r.nights} {r.nights === 1 ? t("noche") : t("noches")}
                  </p>
                  {r.paidAt && <p className="text-xs text-[#999]">{t("Pagado el {date}", { date: day(r.paidAt, lang) })}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-[15px] font-semibold ${r.netMxn > 0 ? "text-[#1e7a3a]" : "text-[#888]"}`}>{mxn(r.netMxn)}</p>
                  {r.refundedMxn > 0 && <p className="text-xs text-red-700">−{mxn(r.refundedMxn)}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
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
