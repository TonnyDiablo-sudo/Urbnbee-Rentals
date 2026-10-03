import Link from "next/link";
import type { TFn } from "@/lib/i18n";
import { getListingStats, type ListingStats } from "@/lib/listing-stats-store";
import { suggestionsForListing } from "@/lib/listing-suggestions";
import { listListingsForHost } from "@/lib/marketplace-store";

function Sparkline({ daily }: { daily: ListingStats["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.v));
  return (
    <div className="flex h-12 items-end gap-[2px]" aria-hidden>
      {daily.map((d) => (
        <div
          key={d.day}
          className={`flex-1 rounded-sm ${d.c > 0 ? "bg-[#dcb81e]" : "bg-[#222]"}`}
          style={{ height: `${Math.max(4, (d.v / max) * 100)}%`, opacity: d.v ? 1 : 0.15 }}
          title={`${d.day}: ${d.v} vistas, ${d.c} contactos`}
        />
      ))}
    </div>
  );
}

/** Vistas, contactos y sugerencias por anuncio. Lo usan la app y el sitio, cada uno con sus rutas. */
export function HostStatsView({
  hostId,
  t,
  surface,
}: {
  hostId: string;
  t: TFn;
  surface: "app" | "web";
}) {
  const newHref = surface === "app" ? "/host/anuncios/nuevo" : "/host/listings/new";
  const editHref = (id: string) => (surface === "app" ? `/host/anuncios/${id}` : `/host/listings/${id}/edit`);
  const rows = listListingsForHost(hostId).map((l) => ({
    listing: l,
    stats: getListingStats(l.id),
    suggestions: suggestionsForListing(l, surface),
  }));
  const total = rows.reduce(
    (acc, r) => ({ v30: acc.v30 + r.stats.views30, c30: acc.c30 + r.stats.contacts30 }),
    { v30: 0, c30: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-[#111] p-4 text-white">
          <p className="text-3xl font-bold text-[#dcb81e]">{total.v30}</p>
          <p className="text-xs text-white/70">{t("vistas en 30 días")}</p>
        </div>
        <div className="rounded-2xl bg-[#111] p-4 text-white">
          <p className="text-3xl font-bold text-[#dcb81e]">{total.c30}</p>
          <p className="text-xs text-white/70">{t("vieron tu contacto en 30 días")}</p>
        </div>
      </div>

      {rows.length === 0 && (
        <p className="py-10 text-center text-sm text-[#717171]">
          {t("Todavía no tienes anuncios.")}{" "}
          <Link href={newHref} className="font-semibold underline">
            {t("Publica uno gratis")}
          </Link>
        </p>
      )}

      {rows.map(({ listing: l, stats, suggestions }) => (
        <section key={l.id} className="rounded-2xl border border-[#ebebeb] bg-white p-4">
          <Link href={editHref(l.id)} className="flex gap-3">
            {l.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.photos[0]} alt="" className="h-16 w-20 shrink-0 rounded-xl object-cover" />
            ) : (
              <div className="h-16 w-20 shrink-0 rounded-xl bg-[#f0f0f0]" />
            )}
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-[#222]">{l.title}</p>
              <p className="text-sm text-[#717171]">
                {t("{v} vistas · {c} contactos (7 días)", { v: stats.views7, c: stats.contacts7 })}
              </p>
              <p className="text-xs text-[#999]">
                {t("Total: {v} vistas · {c} contactos", { v: stats.viewsTotal, c: stats.contactsTotal })}
              </p>
            </div>
          </Link>
          <div className="mt-3">
            <Sparkline daily={stats.daily} />
            <p className="mt-1 text-[11px] text-[#999]">{t("Últimos 30 días · en dorado, días con contactos")}</p>
          </div>
          {suggestions.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {suggestions.slice(0, 5).map((s) => (
                <li key={s.id}>
                  <Link
                    href={s.href ?? editHref(l.id)}
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
            <p className="mt-4 rounded-xl bg-[#e7f5ec] px-3 py-2.5 text-sm text-[#1e5a32]">{t("¡Tu anuncio está completo!")}</p>
          )}
        </section>
      ))}
    </div>
  );
}
