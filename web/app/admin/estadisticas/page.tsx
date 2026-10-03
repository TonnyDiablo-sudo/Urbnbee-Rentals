import Link from "next/link";
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

const nf = new Intl.NumberFormat("es-MX");

function Delta({ total, prev }: { total: number; prev: number }) {
  if (!prev && !total) return <span className="text-gray-300">—</span>;
  if (!prev) return <span className="text-emerald-600">nuevo</span>;
  const pct = Math.round(((total - prev) / prev) * 100);
  const cls = pct > 0 ? "text-emerald-600" : pct < 0 ? "text-red-500" : "text-gray-400";
  return (
    <span className={cls}>
      {pct > 0 ? "▲" : pct < 0 ? "▼" : "="} {Math.abs(pct)}%
    </span>
  );
}

function Bars({ series, labels, tall }: { series: number[]; labels: string[]; tall?: boolean }) {
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

function MetricCard({ m, labels, href, active }: { m: MetricResult; labels: string[]; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`rounded-xl border p-4 flex flex-col gap-2 transition-colors ${
        active ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white hover:border-amber-300"
      }`}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{m.label}</p>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-2xl font-bold text-gray-900">{nf.format(m.total)}</p>
        <p className="text-xs">
          <Delta total={m.total} prev={m.prev} />
        </p>
      </div>
      {labels.length > 1 && <Bars series={m.series} labels={labels} />}
    </Link>
  );
}

export default async function AdminPlatformStatsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const r = one(sp.r) ?? "30d";
  const filter: GeoFilter = { country: one(sp.pais), state: one(sp.estado), city: one(sp.ciudad) };
  const demo = one(sp.demo) === "1";
  const d = getPlatformDashboard(r, filter, demo);
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
  const where = [filter.city, filter.state, filter.country].filter(Boolean).join(", ") || "Toda la plataforma";

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Estadísticas de la plataforma</h1>
        <p className="text-sm text-gray-500 mt-1">
          {where} · del {d.from} al {d.to} (hora del centro de México). Las flechas comparan contra el periodo anterior de
          la misma duración.
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
            {x.label}
          </Link>
        ))}
      </div>

      <form method="get" action="/admin/estadisticas" className="flex flex-wrap items-end gap-3 mb-8 bg-white border border-gray-200 rounded-xl p-4">
        <input type="hidden" name="r" value={d.range.id} />
        {base.m && <input type="hidden" name="m" value={base.m} />}
        {demo && <input type="hidden" name="demo" value="1" />}
        {(
          [
            ["pais", "País", d.options.countries, filter.country],
            ["estado", "Estado", d.options.states, filter.state],
            ["ciudad", "Ciudad", d.options.cities, filter.city],
          ] as const
        ).map(([name, label, opts, value]) => (
          <label key={name} className="flex flex-col gap-1 text-xs font-medium text-gray-500">
            {label}
            <select
              name={name}
              defaultValue={value ?? ""}
              className="min-w-44 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
            >
              <option value="">Todos</option>
              {opts.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button type="submit" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">
          Aplicar
        </button>
        {(filter.country || filter.state || filter.city) && (
          <Link href={hrefWith({ r: d.range.id, m: base.m, demo: base.demo }, {})} className="px-2 py-2 text-sm text-gray-500 underline">
            Quitar filtros
          </Link>
        )}
        <Link
          href={hrefWith(base, { demo: demo ? undefined : "1" })}
          className={`ml-auto px-3 py-2 rounded-lg text-sm border ${
            demo ? "border-amber-400 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-500 hover:border-amber-300"
          }`}
        >
          {demo ? "✓ Incluyendo cuentas demo" : "Incluir cuentas demo"}
        </Link>
        <p className="basis-full text-[11px] text-gray-400">
          Al cambiar de país o estado, aplica primero para que se actualicen las opciones de abajo.
        </p>
      </form>

      <section className="mb-10 bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-baseline justify-between mb-4">
          <p className="text-sm font-semibold text-gray-900">
            {chart.label} <span className="font-normal text-gray-400">por {d.bucketUnit}</span>
          </p>
          <p className="text-2xl font-bold text-gray-900">{nf.format(chart.total)}</p>
        </div>
        <Bars series={chart.series} labels={d.bucketLabels} tall />
        {d.bucketLabels.length > 1 && (
          <div className="flex justify-between mt-2 text-[11px] text-gray-400">
            <span>{d.bucketLabels[0]}</span>
            <span>{d.bucketLabels[Math.floor(d.bucketLabels.length / 2)]}</span>
            <span>{d.bucketLabels.at(-1)}</span>
          </div>
        )}
        <p className="mt-3 text-[11px] text-gray-400">Toca cualquier tarjeta para verla aquí.</p>
      </section>

      {groups.map((g) => (
        <section key={g} className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">{g}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {d.metrics
              .filter((m) => m.group === g)
              .map((m) => (
                <MetricCard
                  key={m.key}
                  m={m}
                  labels={d.bucketLabels}
                  href={hrefWith(base, { m: m.key })}
                  active={m.key === chartKey}
                />
              ))}
          </div>
        </section>
      ))}

      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Por {d.breakdown.level}</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-3 font-medium capitalize">{d.breakdown.level}</th>
                {BREAKDOWN_METRICS.map((k) => (
                  <th key={k} className="px-4 py-3 font-medium text-right">
                    {METRICS.find((m) => m.key === k)!.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.breakdown.rows.length === 0 && (
                <tr>
                  <td colSpan={BREAKDOWN_METRICS.length + 1} className="px-4 py-6 text-center text-gray-400">
                    Sin datos en este periodo.
                  </td>
                </tr>
              )}
              {d.breakdown.rows.map((row) => (
                <tr key={row.place} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 text-gray-900">
                    {d.breakdown.level === "estado" && !filter.state && row.place !== "Sin dato" ? (
                      <Link href={hrefWith(base, { estado: row.place.replace(/ \(.+\)$/, ""), ciudad: undefined })} className="hover:underline">
                        {row.place}
                      </Link>
                    ) : (
                      row.place
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
        Visitantes y páginas vistas se cuentan desde que se activó el contador del sitio; la ubicación del visitante sale
        de su IP y es aproximada. Clics, contactos, chats y reservas se ubican por la ciudad del anuncio; las cuentas, por
        el lugar desde donde entró la persona o, si es anfitrión, por su primer anuncio. Las suscripciones anteriores a que
        se guardara su fecha de alta usan su última actualización. No se cuentan visitas de administradores ni de bots. Las
        cuentas demo (@urbnbee.test) quedan fuera salvo que las incluyas: sus números son inventados.
      </p>
    </div>
  );
}
