import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LangSwitch } from "@/components/lang-switch";
import { FilterButton } from "@/components/browse/filter-button";
import { APP_BROWSE_FILTERS, appBrowseListings, appPriceRange } from "@/lib/app-listings";
import { activeFilterCount, parseBrowseFilters, writeBrowseFilters } from "@/lib/browse-filters";
import { getLang, getT } from "@/lib/i18n/server";
import { localizeCards } from "@/lib/listing-localize";
import { getSessionUser } from "@/lib/session";
import { IconSearch } from "./_components/icons";
import { AppListingCardView } from "./_components/listing-card";
import { InstallBanner } from "./_components/install-banner";
import { NotificationBell } from "./_components/notifications";
import { Brand } from "./_components/top-bar";
import { ExploreMap } from "./explore-map";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Explorar") };
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AppExplorePage({ searchParams }: Props) {
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const [q, tipo, source, vista, verif] = ["q", "tipo", "source", "vista", "verif"].map(one);
  const filters = parseBrowseFilters(sp);
  const filterCount = activeFilterCount(filters);

  // Al abrir el ícono instalado se vuelve al modo en que la persona se quedó.
  if (source === "pwa") {
    const user = await getSessionUser();
    const mode = (await cookies()).get("cabibee_mode")?.value;
    if (mode === "host" && (user?.role === "host" || user?.role === "admin")) redirect("/host");
  }

  const t = await getT();
  const mapView = vista === "mapa";
  const verifiedOnly = verif === "1";
  const listings = await localizeCards(appBrowseListings({ tipo, q, verifiedOnly, filters }), await getLang());
  const hrefWith = (next: { tipo?: string; vista?: string; verif?: boolean }) => {
    const p = new URLSearchParams();
    const nt = next.tipo ?? tipo;
    if (nt) p.set("tipo", nt);
    if (next.verif ?? verifiedOnly) p.set("verif", "1");
    const nv = next.vista ?? vista;
    if (nv === "mapa") p.set("vista", "mapa");
    if (q) p.set("q", q);
    writeBrowseFilters(filters, p);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };
  const mapItems = listings
    .filter((l) => l.lat !== null && l.lng !== null)
    .map((l) => ({
      id: l.id,
      href: `/alojamiento/${l.slug}`,
      title: l.title,
      subtitle: [l.city, l.zone].filter(Boolean).join(", "),
      imageSrc: l.imageSrc,
      pricePerNight: l.pricePerNight,
      rating: l.rating,
      identityVerified: l.identityVerified,
      lat: l.lat as number,
      lng: l.lng as number,
    }));

  return (
    <>
      <div
        className="sticky top-0 z-30 bg-white px-4 pb-2"
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <Brand />
          <div className="flex items-center gap-1">
            <LangSwitch />
            <NotificationBell />
          </div>
        </div>
        <form action="/" className="relative">
          {mapView && <input type="hidden" name="vista" value="mapa" />}
          {verifiedOnly && <input type="hidden" name="verif" value="1" />}
          {[...writeBrowseFilters(filters, new URLSearchParams()).entries()].map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#222]" />
          <input
            name="q"
            defaultValue={q}
            placeholder={t("¿A dónde vas? Ciudad, zona o tipo")}
            enterKeyHint="search"
            className="w-full rounded-full border border-[#e5e5e5] bg-white py-3.5 pl-12 pr-4 text-base shadow-[0_3px_12px_rgba(0,0,0,0.08)] outline-none placeholder:text-[#8a8a8a] focus:border-[#222]"
          />
        </form>
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <FilterButton
            basePath="/"
            params={Object.fromEntries(
              Object.keys(sp)
                .filter((k) => k !== "source")
                .map((k) => [k, one(k)])
            )}
            priceRange={appPriceRange()}
          />
          <Link
            href="/recomendar"
            className="shrink-0 rounded-full border border-[#dcb81e] bg-[#fdf6d8] px-4 py-2 text-[13px] font-semibold text-[#5c4a0a]"
          >
            {t("✨ Recomiéndame")}
          </Link>
          <Link
            href={hrefWith({ verif: !verifiedOnly })}
            className={`shrink-0 rounded-full border px-4 py-2 text-[13px] font-medium ${
              verifiedOnly ? "border-[#1e7a3a] bg-[#1e7a3a] text-white" : "border-[#e0e0e0] bg-white text-[#1e7a3a]"
            }`}
          >
            {t("✓ Verificados")}
          </Link>
          {APP_BROWSE_FILTERS.map((f) => {
            const active = f.key === tipo;
            return (
              <Link
                key={f.key || "all"}
                href={hrefWith({ tipo: f.key })}
                className={`shrink-0 rounded-full border px-4 py-2 text-[13px] font-medium ${
                  active ? "border-black bg-black text-white" : "border-[#e0e0e0] bg-white text-[#484848]"
                }`}
              >
                {t(f.label)}
              </Link>
            );
          })}
        </div>
      </div>

      {mapView ? (
        <ExploreMap items={mapItems} />
      ) : (
        <>
          <InstallBanner />
          <div className="space-y-7 px-4 pb-6 pt-3">
            {listings.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-base font-semibold text-[#222]">{t("Sin resultados")}</p>
                <p className="mt-1 text-sm text-[#717171]">
                  {filterCount > 0 ? t("Prueba subir el precio o quitar algunos filtros.") : t("Prueba otra ciudad o quita el filtro.")}
                </p>
                <Link href="/" className="mt-4 inline-block text-sm font-semibold underline">
                  {filterCount > 0 ? t("Quitar filtros") : t("Ver todo")}
                </Link>
              </div>
            ) : (
              listings.map((l, i) => <AppListingCardView key={l.id} listing={l} t={t} priority={i === 0} />)
            )}
          </div>
        </>
      )}

      <div
        className="pointer-events-none fixed inset-x-0 z-40 flex justify-center"
        style={{ bottom: "calc(80px + env(safe-area-inset-bottom))" }}
      >
        <Link
          href={hrefWith({ vista: mapView ? "" : "mapa" })}
          scroll={!mapView}
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#222] px-5 py-3 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(0,0,0,0.3)] active:scale-95"
        >
          {mapView ? (
            <>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
              </svg>
              {t("Lista")}
            </>
          ) : (
            <>
              {t("Mapa")}
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinejoin="round" d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Zm0 0v13m6-10.5v13" />
              </svg>
            </>
          )}
        </Link>
      </div>
    </>
  );
}
