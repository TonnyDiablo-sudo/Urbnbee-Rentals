import Link from "next/link";
import type { Lang, TFn } from "@/lib/i18n";
import { INSIGHT_RANGES, type InsightDay, type ListingInsights } from "@/lib/listing-insights";
import { suggestionsForListing } from "@/lib/listing-suggestions";
import type { HostListingRecord } from "@/lib/marketplace-types";

function pct(a: number, b: number): number | null {
  return b > 0 ? Math.round((a / b) * 1000) / 10 : null;
}

function Delta({ now, before, t }: { now: number; before: number; t: TFn }) {
  if (before === 0 && now === 0) return null;
  if (before === 0) return <span className="text-xs font-semibold text-[#1e7a3a]">{t("nuevo")}</span>;
  const d = Math.round(((now - before) / before) * 100);
  if (d === 0) return <span className="text-xs text-[#999]">= </span>;
  return (
    <span className={`text-xs font-semibold ${d > 0 ? "text-[#1e7a3a]" : "text-[#c2410c]"}`}>
      {d > 0 ? "▲" : "▼"} {Math.abs(d)}%
    </span>
  );
}

function Kpi({ label, value, now, before, t }: { label: string; value: string; now?: number; before?: number; t: TFn }) {
  return (
    <div className="rounded-2xl border border-[#ebebeb] bg-white p-3">
      <p className="text-[22px] font-bold leading-tight text-[#222]">{value}</p>
      <p className="text-xs text-[#717171]">{label}</p>
      {now !== undefined && before !== undefined && (
        <p className="mt-1">
          <Delta now={now} before={before} t={t} />
        </p>
      )}
    </div>
  );
}

/** Barras por día: altura = vistas, dorado = hubo contactos ese día. */
function DailyChart({ daily, lang, t }: { daily: InsightDay[]; lang: Lang; t: TFn }) {
  const max = Math.max(1, ...daily.map((d) => d.v));
  const W = 320;
  const H = 120;
  const gap = daily.length > 60 ? 1 : 2;
  const bw = (W - gap * (daily.length - 1)) / daily.length;
  const label = (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(lang === "en" ? "en-US" : "es-MX", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  };
  const ticks = [0, Math.floor((daily.length - 1) / 2), daily.length - 1];
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label={t("Vistas por día")}>
        {[0.5, 1].map((f) => (
          <line key={f} x1={0} x2={W} y1={H - H * f} y2={H - H * f} stroke="#eee" strokeDasharray="3 3" />
        ))}
        <text x={W} y={10} textAnchor="end" fontSize={9} fill="#999">
          {max}
        </text>
        {daily.map((d, i) => {
          const h = Math.max(d.v ? 2 : 1, (d.v / max) * (H - 14));
          const x = i * (bw + gap);
          const cH = d.v ? (d.c / Math.max(d.v, 1)) * h : 0;
          return (
            <g key={d.day}>
              <title>{t("{day}: {v} vistas, {c} contactos, {m} conversaciones, {r} solicitudes", { ...d, day: label(d.day) })}</title>
              <rect x={x} y={H - h} width={bw} height={h} rx={Math.min(2, bw / 2)} fill={d.v ? "#222" : "#ddd"} />
              {cH > 0 && <rect x={x} y={H - cH} width={bw} height={cH} rx={Math.min(2, bw / 2)} fill="#dcb81e" />}
            </g>
          );
        })}
        {ticks.map((i) => (
          <text
            key={i}
            x={i * (bw + gap) + bw / 2}
            y={H + 13}
            fontSize={9}
            fill="#999"
            textAnchor={i === 0 ? "start" : i === daily.length - 1 ? "end" : "middle"}
          >
            {label(daily[i].day)}
          </text>
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#777]">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#222]" />
          {t("Vistas")}
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#dcb81e]" />
          {t("Parte que vio tu contacto")}
        </span>
      </figcaption>
    </figure>
  );
}

/** Puntos por día para conversaciones (●) y solicitudes (■). */
function ActivityStrip({ daily, t }: { daily: InsightDay[]; t: TFn }) {
  const max = Math.max(1, ...daily.map((d) => Math.max(d.m, d.r)));
  const W = 320;
  const H = 44;
  const step = W / daily.length;
  const any = daily.some((d) => d.m || d.r);
  if (!any) return <p className="text-sm text-[#999]">{t("Sin conversaciones ni solicitudes en este periodo.")}</p>;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t("Conversaciones y solicitudes por día")}>
        <line x1={0} x2={W} y1={H - 1} y2={H - 1} stroke="#eee" />
        {daily.map((d, i) => {
          const x = i * step + step / 2;
          return (
            <g key={d.day}>
              {d.m > 0 && <circle cx={x - 1.5} cy={H - 4 - (d.m / max) * (H - 12)} r={3} fill="#3b82f6" />}
              {d.r > 0 && <rect x={x - 1} y={H - 7 - (d.r / max) * (H - 12)} width={6} height={6} rx={1} fill="#16a34a" />}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex gap-4 text-[11px] text-[#777]">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#3b82f6]" />
          {t("Conversaciones nuevas")}
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#16a34a]" />
          {t("Solicitudes de reserva")}
        </span>
      </figcaption>
    </figure>
  );
}

function Funnel({ steps, t }: { steps: { label: string; n: number }[]; t: TFn }) {
  const top = Math.max(1, steps[0].n);
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const p = pct(s.n, i === 0 ? s.n : steps[i - 1].n);
        return (
          <li key={s.label}>
            <div className="flex justify-between text-sm">
              <span className="text-[#222]">{s.label}</span>
              <span className="font-semibold text-[#222]">
                {s.n}
                {i > 0 && p !== null && <span className="ml-1 text-xs font-normal text-[#888]">({p}%)</span>}
              </span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#f1f1f1]">
              <div
                className="h-full rounded-full bg-[#dcb81e]"
                style={{ width: `${Math.max(s.n ? 2 : 0, (s.n / top) * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
      <li className="pt-1 text-[11px] text-[#999]">{t("Entre paréntesis: cuántos pasaron del paso anterior.")}</li>
    </ol>
  );
}

function Weekdays({ values, t }: { values: number[]; t: TFn }) {
  const names = [t("Lun"), t("Mar"), t("Mié"), t("Jue"), t("Vie"), t("Sáb"), t("Dom")];
  const max = Math.max(1, ...values);
  const best = values.indexOf(Math.max(...values));
  return (
    <div>
      <div className="flex h-24 items-end gap-2">
        {values.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] text-[#888]">{v}</span>
            <div
              className={`w-full rounded-t-md ${i === best && v > 0 ? "bg-[#dcb81e]" : "bg-[#222]"}`}
              style={{ height: `${Math.max(v ? 4 : 2, (v / max) * 64)}px`, opacity: v ? 1 : 0.2 }}
            />
            <span className="text-[11px] text-[#555]">{names[i]}</span>
          </div>
        ))}
      </div>
      {values[best] > 0 && (
        <p className="mt-2 text-xs text-[#717171]">
          {t("{day} es tu día con más vistas: buen momento para ajustar precio o mandar promociones.", { day: names[best] })}
        </p>
      )}
    </div>
  );
}

function money(n: number, lang: Lang) {
  return `$${Math.round(n).toLocaleString(lang === "en" ? "en-US" : "es-MX")}`;
}

function minutesText(m: number, t: TFn) {
  if (m < 60) return t("{n} min", { n: m });
  if (m < 60 * 24) return t("{n} h", { n: Math.round(m / 6) / 10 });
  return t("{n} días", { n: Math.round(m / 144) / 10 });
}

export function ListingInsightsView({
  listing,
  data,
  t,
  lang,
  surface,
  basePath,
}: {
  listing: HostListingRecord;
  data: ListingInsights;
  t: TFn;
  lang: Lang;
  surface: "app" | "web";
  basePath: string;
}) {
  const { totals: n, previous: p } = data;
  const editHref = surface === "app" ? `/host/anuncios/${listing.id}` : `/host/listings/${listing.id}/edit`;
  const suggestions = suggestionsForListing(listing, surface);
  const card = "rounded-2xl border border-[#ebebeb] bg-white p-4";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {listing.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.photos[0]} alt="" className="h-16 w-20 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="h-16 w-20 shrink-0 rounded-xl bg-[#f0f0f0]" />
        )}
        <div className="min-w-0">
          <p className="line-clamp-2 text-[16px] font-semibold text-[#222]">{listing.title}</p>
          <p className="text-xs text-[#888]">
            {t("Total: {v} vistas · {c} contactos", { v: data.allTime.views, c: data.allTime.contacts })}
          </p>
        </div>
      </div>

      <nav className="flex gap-2" aria-label={t("Periodo")}>
        {INSIGHT_RANGES.map((r) => (
          <Link
            key={r}
            href={`${basePath}?d=${r}`}
            replace
            scroll={false}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${
              r === data.range ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] bg-white text-[#222]"
            }`}
          >
            {t("{n} días", { n: r })}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi t={t} label={t("Vistas")} value={String(n.views)} now={n.views} before={p.views} />
        <Kpi t={t} label={t("Vieron tu contacto")} value={String(n.contacts)} now={n.contacts} before={p.contacts} />
        <Kpi t={t} label={t("Conversaciones nuevas")} value={String(n.conversations)} now={n.conversations} before={p.conversations} />
        <Kpi t={t} label={t("Solicitudes de reserva")} value={String(n.requests)} now={n.requests} before={p.requests} />
        <Kpi t={t} label={t("Reservas confirmadas")} value={String(n.confirmed)} now={n.confirmed} before={p.confirmed} />
        <Kpi t={t} label={t("Noches reservadas")} value={String(n.nights)} now={n.nights} before={p.nights} />
        <Kpi t={t} label={t("Ingresos (MXN)")} value={money(n.revenueMxn, lang)} now={n.revenueMxn} before={p.revenueMxn} />
        <Kpi
          t={t}
          label={t("Tasa de contacto")}
          value={pct(n.contacts, n.views) !== null ? `${pct(n.contacts, n.views)}%` : "—"}
        />
      </div>
      <p className="-mt-2 text-[11px] text-[#999]">{t("Las flechas comparan con los {n} días anteriores.", { n: data.range })}</p>

      <section className={card}>
        <h2 className="mb-3 text-[15px] font-semibold text-[#222]">{t("Vistas por día")}</h2>
        <DailyChart daily={data.daily} lang={lang} t={t} />
      </section>

      <section className={card}>
        <h2 className="mb-3 text-[15px] font-semibold text-[#222]">{t("Interacciones")}</h2>
        <ActivityStrip daily={data.daily} t={t} />
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-[#717171]">{t("Respondes en")}</dt>
            <dd className="font-semibold text-[#222]">
              {data.responseMinutes === null ? "—" : minutesText(data.responseMinutes, t)}
            </dd>
          </div>
          <div>
            <dt className="text-[#717171]">{t("Ocupación próximos 30 días")}</dt>
            <dd className="font-semibold text-[#222]">
              {Math.round((data.upcomingNights / 30) * 100)}%{" "}
              <span className="font-normal text-[#888]">({t("{n} noches", { n: data.upcomingNights })})</span>
            </dd>
          </div>
        </dl>
      </section>

      <section className={card}>
        <h2 className="mb-3 text-[15px] font-semibold text-[#222]">{t("De vista a reserva")}</h2>
        <Funnel
          t={t}
          steps={[
            { label: t("Vistas"), n: n.views },
            { label: t("Vieron tu contacto"), n: n.contacts },
            { label: t("Te escribieron"), n: n.conversations },
            { label: t("Pidieron reservar"), n: n.requests },
            { label: t("Reservaron"), n: n.confirmed },
          ]}
        />
      </section>

      <section className={card}>
        <h2 className="mb-3 text-[15px] font-semibold text-[#222]">{t("Qué días te ven más")}</h2>
        <Weekdays values={data.weekday} t={t} />
      </section>

      <section className={card}>
        <h2 className="mb-3 text-[15px] font-semibold text-[#222]">{t("Sugerencias")}</h2>
        {suggestions.length > 0 ? (
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li key={s.id}>
                <Link
                  href={s.href ?? editHref}
                  className={`block rounded-xl px-3 py-2.5 text-sm leading-snug ${
                    s.impact === "high" ? "bg-[#fdf6d8] text-[#5c4a0a]" : "bg-[#f7f7f7] text-[#484848]"
                  }`}
                >
                  {s.impact === "high" ? "⚡ " : "💡 "}
                  {t(s.text)}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-[#e7f5ec] px-3 py-2.5 text-sm text-[#1e5a32]">{t("¡Tu anuncio está completo!")}</p>
        )}
        <Link href={editHref} className="mt-3 inline-block text-sm font-semibold text-[#222] underline">
          {t("Editar anuncio")}
        </Link>
      </section>
    </div>
  );
}
