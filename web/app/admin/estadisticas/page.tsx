import Link from "next/link";
import { getAdminSnapshot, type AdminSnapshot } from "@/lib/admin-data";
import { UNKNOWN } from "@/lib/geo-places";
import { numberLocale, type Lang, type TFn } from "@/lib/i18n";
import { getLang, getT } from "@/lib/i18n/server";
import {
  BREAKDOWN_METRICS,
  getPlatformDashboard,
  METRICS,
  RANGES,
  type GeoFilter,
  type MetricResult,
} from "@/lib/platform-analytics";

type SP = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() || undefined;
}

function hrefWith(base: Record<string, string | undefined>, patch: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) q.set(k, v);
  const s = q.toString();
  return `/admin/estadisticas${s ? `?${s}` : ""}`;
}

const MONTH_EN: Record<string, string> = {
  ene: "Jan",
  feb: "Feb",
  mar: "Mar",
  abr: "Apr",
  may: "May",
  jun: "Jun",
  jul: "Jul",
  ago: "Aug",
  sep: "Sep",
  oct: "Oct",
  nov: "Nov",
  dic: "Dec",
};

/** Las etiquetas de la gráfica vienen como "5 ene" o "ene 26". */
function bucketLabel(label: string, lang: Lang): string {
  return lang === "en" ? label.replace(/[a-z]{3}/, (m) => MONTH_EN[m] ?? m) : label;
}

function Delta({ total, prev, t }: { total: number; prev: number; t: TFn }) {
  if (!prev && !total) return <span className="text-gray-300">—</span>;
  if (!prev) return <span className="text-emerald-600">{t("nuevo")}</span>;
  const pct = Math.round(((total - prev) / prev) * 100);
  const cls = pct > 0 ? "text-emerald-600" : pct < 0 ? "text-red-500" : "text-gray-400";
  return (
    <span className={cls}>
      {pct > 0 ? "▲" : pct < 0 ? "▼" : "="} {Math.abs(pct)}%
    </span>
  );
}

function Bars({ series, labels, tall, nf }: { series: number[]; labels: string[]; tall?: boolean; nf: Intl.NumberFormat }) {
  const max = Math.max(1, ...series);
  return (
    <div className={`flex items-end gap-px ${tall ? "h-40" : "h-10"}`}>
      {series.map((v, i) => (
        <div
          key={i}
          title={`${labels[i]}: ${nf.format(v)}`}
          className={`flex-1 rounded-t-sm ${v ? "bg-amber-400" : "bg-gray-100"} hover:bg-amber-600`}
          style={{ height: `${Math.max(v ? 4 : 2, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function MetricCard({
  m,
  labels,
  href,
  active,
  t,
  nf,
}: {
  m: MetricResult;
  labels: string[];
  href: string;
  active: boolean;
  t: TFn;
  nf: Intl.NumberFormat;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`rounded-xl border p-4 flex flex-col gap-2 transition-colors ${
        active ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white hover:border-amber-300"
      }`}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t(m.label)}</p>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-2xl font-bold text-gray-900">{nf.format(m.total)}</p>
        <p className="text-xs">
          <Delta total={m.total} prev={m.prev} t={t} />
        </p>
      </div>
      {labels.length > 1 && <Bars series={m.series} labels={labels} nf={nf} />}
    </Link>
  );
}

const BOOKING_STATUS_ES: Record<string, string> = {
  AWAITING_PAYMENT: "Esperando pago",
  PENDING: "Pendiente",
  PENDING_HOST: "Pendiente anfitrión",
  AWAITING_DETAILS: "Esperando datos",
  CONFIRMED: "Confirmada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
  EXPIRED: "Expirada",
};

function Snap({ label, value, sub, href, alert }: { label: string; value: React.ReactNode; sub?: string; href?: string; alert?: boolean }) {
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${alert ? "text-red-600" : "text-gray-900"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-500">{sub}</p>}
    </>
  );
  const cls = `rounded-xl border p-4 ${alert ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`;
  return href ? (
    <Link href={href} className={`${cls} hover:border-amber-300`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function CurrentState({ s, t, nf }: { s: AdminSnapshot; t: TFn; nf: Intl.NumberFormat }) {
  const mxn = (n: number) => `$${nf.format(Math.round(n))}`;
  const statuses = Object.entries(s.bookingsByStatus).filter(([, n]) => (n ?? 0) > 0) as [string, number][];
  const max = Math.max(1, ...statuses.map(([, n]) => n));
  const pending = "/admin/users?pendientes=1";
  return (
    <section className="mb-10">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">{t("Estado actual")}</h2>
      <p className="mb-3 text-[11px] text-gray-400">
        {t("Totales de hoy, sin filtro de periodo ni lugar. El detalle de cada uno está en la ficha del usuario.")}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <Snap
          label={t("Reservas")}
          value={nf.format(s.totalBookings)}
          sub={t("{paid} pagadas · {refunded} reembolsadas", { paid: s.paidBookings, refunded: s.refundedBookings })}
        />
        <Snap
          label={t("Ingresos por estancias")}
          value={mxn(s.totalStayRevenueMxn)}
          sub={t("comisión {fee} · devuelto {refunded}", { fee: mxn(s.totalPlatformFeeMxn), refunded: mxn(s.totalRefundedMxn) })}
        />
        <Snap
          label={t("Comprobantes por revisar")}
          value={s.addressProofs.review + s.addressProofs.pending}
          sub={t("{approved} aprobados ({ai} por IA) · {rejected} rechazados", {
            approved: s.addressProofs.approved,
            ai: s.addressProofs.approvedByAi,
            rejected: s.addressProofs.rejected,
          })}
          href={pending}
          alert={s.addressProofs.review > 0}
        />
        <Snap
          label={t("Ubicación verificada")}
          value={`${s.locationVerifiedListings} / ${s.publishedListings}`}
          sub={t("anuncios publicados con comprobante aprobado")}
        />
        <Snap
          label={t("Reclamos de anuncios abiertos")}
          value={s.listingClaims.open}
          sub={t("{count} en total", { count: s.listingClaims.total })}
          href={pending}
          alert={s.listingClaims.open > 0}
        />
        <Snap
          label={t("Reportes abiertos")}
          value={s.reports.open}
          sub={t("{count} reportes y sugerencias en total", { count: s.reports.total })}
          href="/admin/reportes"
          alert={s.reports.open > 0}
        />
        <Snap
          label={t("Altas con IA (asociados)")}
          value={s.associates.accounts}
          sub={t("{claimed} reclamadas · {associates} asociados · {pending} borradores por revisar · {published} publicados", {
            claimed: s.associates.claimed,
            associates: s.associates.associates,
            pending: s.associates.draftsPending,
            published: s.associates.draftsPublished,
          })}
        />
        <Snap
          label={t("Identidad y membresía")}
          value={s.identity.kycVerified}
          sub={t("identidades verificadas · {ribbon} con listón · {memberships} membresías activas", {
            ribbon: s.identity.hostRibbon,
            memberships: s.identity.activeMemberships,
          })}
        />
      </div>
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t("Reservas por estado")}</p>
        {statuses.length === 0 ? (
          <p className="text-sm text-gray-400">{t("Sin reservas.")}</p>
        ) : (
          <ul className="space-y-1.5">
            {statuses
              .sort((a, b) => b[1] - a[1])
              .map(([st, n]) => (
                <li key={st} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 text-gray-600">{BOOKING_STATUS_ES[st] ? t(BOOKING_STATUS_ES[st]) : st}</span>
                  <span className="h-2.5 rounded bg-amber-400" style={{ width: `${(n / max) * 60}%` }} />
                  <span className="text-gray-700">{n}</span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </section>
  );
}

const UNIT_LABEL: Record<string, string> = { día: "por día", semana: "por semana", mes: "por mes" };
const LEVEL_LABEL: Record<string, string> = { estado: "Por estado", ciudad: "Por ciudad" };

export default async function AdminPlatformStatsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const t = await getT();
  const lang = await getLang();
  const nf = new Intl.NumberFormat(numberLocale(lang));
  const r = one(sp.r) ?? "30d";
  const filter: GeoFilter = { country: one(sp.pais), state: one(sp.estado), city: one(sp.ciudad) };
  const demo = one(sp.demo) === "1";
  const d = getPlatformDashboard(r, filter, demo);
  const labels = d.bucketLabels.map((l) => bucketLabel(l, lang));
  const base = {
    r: d.range.id,
    pais: filter.country,
    estado: filter.state,
    ciudad: filter.city,
    m: one(sp.m),
    demo: demo ? "1" : undefined,
  };
  const chartKey = METRICS.some((m) => m.key === base.m) ? base.m! : "visitors";
  const chart = d.metrics.find((m) => m.key === chartKey)!;
  const groups = [...new Set(METRICS.map((m) => m.group))];
  const where = [filter.city, filter.state, filter.country].filter(Boolean).join(", ") || t("Toda la plataforma");
  const placeLabel = (p: string) => (p === UNKNOWN ? t(UNKNOWN) : p);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("Estadísticas de la plataforma")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t(
            "{where} · del {from} al {to} (hora del centro de México). Las flechas comparan contra el periodo anterior de la misma duración.",
            { where, from: d.from, to: d.to }
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {RANGES.map((x) => (
          <Link
            key={x.id}
            href={hrefWith(base, { r: x.id })}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
              x.id === d.range.id
                ? "bg-amber-500 border-amber-500 text-white"
                : "bg-white border-gray-200 text-gray-700 hover:border-amber-300"
            }`}
          >
            {t(x.label)}
          </Link>
        ))}
      </div>

      <form method="get" action="/admin/estadisticas" className="flex flex-wrap items-end gap-3 mb-8 bg-white border border-gray-200 rounded-xl p-4">
        <input type="hidden" name="r" value={d.range.id} />
        {base.m && <input type="hidden" name="m" value={base.m} />}
        {demo && <input type="hidden" name="demo" value="1" />}
        {(
          [
            ["pais", t("País"), d.options.countries, filter.country],
            ["estado", t("Estado / provincia"), d.options.states, filter.state],
            ["ciudad", t("Ciudad"), d.options.cities, filter.city],
          ] as const
        ).map(([name, label, opts, value]) => (
          <label key={name} className="flex flex-col gap-1 text-xs font-medium text-gray-500">
            {label}
            <select
              name={name}
              defaultValue={value ?? ""}
              className="min-w-44 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
            >
              <option value="">{t("Todos")}</option>
              {opts.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button type="submit" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">
          {t("Aplicar")}
        </button>
        {(filter.country || filter.state || filter.city) && (
          <Link href={hrefWith({ r: d.range.id, m: base.m, demo: base.demo }, {})} className="px-2 py-2 text-sm text-gray-500 underline">
            {t("Quitar filtros")}
          </Link>
        )}
        <Link
          href={hrefWith(base, { demo: demo ? undefined : "1" })}
          className={`ml-auto px-3 py-2 rounded-lg text-sm border ${
            demo ? "border-amber-400 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-500 hover:border-amber-300"
          }`}
        >
          {demo ? t("✓ Incluyendo cuentas demo") : t("Incluir cuentas demo")}
        </Link>
        <p className="basis-full text-[11px] text-gray-400">
          {t("Al cambiar de país o estado, aplica primero para que se actualicen las opciones de abajo.")}
        </p>
      </form>

      <section className="mb-10 bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-baseline justify-between mb-4">
          <p className="text-sm font-semibold text-gray-900">
            {t(chart.label)} <span className="font-normal text-gray-400">{t(UNIT_LABEL[d.bucketUnit] ?? d.bucketUnit)}</span>
          </p>
          <p className="text-2xl font-bold text-gray-900">{nf.format(chart.total)}</p>
        </div>
        <Bars series={chart.series} labels={labels} tall nf={nf} />
        {labels.length > 1 && (
          <div className="flex justify-between mt-2 text-[11px] text-gray-400">
            <span>{labels[0]}</span>
            <span>{labels[Math.floor(labels.length / 2)]}</span>
            <span>{labels.at(-1)}</span>
          </div>
        )}
        <p className="mt-3 text-[11px] text-gray-400">{t("Toca cualquier tarjeta para verla aquí.")}</p>
      </section>

      {groups.map((g) => (
        <section key={g} className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">{t(g)}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {d.metrics
              .filter((m) => m.group === g)
              .map((m) => (
                <MetricCard
                  key={m.key}
                  m={m}
                  labels={labels}
                  href={hrefWith(base, { m: m.key })}
                  active={m.key === chartKey}
                  t={t}
                  nf={nf}
                />
              ))}
          </div>
        </section>
      ))}

      <CurrentState s={getAdminSnapshot()} t={t} nf={nf} />

      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">{t(LEVEL_LABEL[d.breakdown.level])}</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-3 font-medium">{d.breakdown.level === "ciudad" ? t("Ciudad") : t("Estado / provincia")}</th>
                {BREAKDOWN_METRICS.map((k) => (
                  <th key={k} className="px-4 py-3 font-medium text-right">
                    {t(METRICS.find((m) => m.key === k)!.label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.breakdown.rows.length === 0 && (
                <tr>
                  <td colSpan={BREAKDOWN_METRICS.length + 1} className="px-4 py-6 text-center text-gray-400">
                    {t("Sin datos en este periodo.")}
                  </td>
                </tr>
              )}
              {d.breakdown.rows.map((row) => (
                <tr key={row.place} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 text-gray-900">
                    {d.breakdown.level === "estado" && !filter.state && row.place !== UNKNOWN ? (
                      <Link href={hrefWith(base, { estado: row.place.replace(/ \(.+\)$/, ""), ciudad: undefined })} className="hover:underline">
                        {row.place}
                      </Link>
                    ) : (
                      placeLabel(row.place)
                    )}
                  </td>
                  {BREAKDOWN_METRICS.map((k) => (
                    <td key={k} className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                      {row.values[k] ? nf.format(row.values[k]!) : <span className="text-gray-300">0</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] leading-relaxed text-gray-400 max-w-3xl">
        {t(
          "Visitantes y páginas vistas se cuentan desde que se activó el contador del sitio; la ubicación del visitante sale de su IP y es aproximada. Clics, contactos, chats y reservas se ubican por la ciudad del anuncio; las cuentas, por el lugar desde donde entró la persona o, si es anfitrión, por su primer anuncio. Las suscripciones anteriores a que se guardara su fecha de alta usan su última actualización. No se cuentan visitas de administradores ni de bots. Las cuentas demo (@urbnbee.test) quedan fuera salvo que las incluyas: sus números son inventados."
        )}
      </p>
    </div>
  );
}
