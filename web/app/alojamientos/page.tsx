import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ListingCard } from "@/components/listing-card";
import { FilterButton } from "@/components/browse/filter-button";
import { LazySearchMap } from "@/components/search/search-map-lazy";
import { appPriceRange, listingIsBookable } from "@/lib/app-listings";
import { activeFilterCount, matchesBrowseFilters, parseBrowseFilters, writeBrowseFilters } from "@/lib/browse-filters";
import { matchesBrowseQuery } from "@/lib/browse-query";
import { BROWSE_TITLES, getBrowseListings } from "@/lib/browse-merge";
import { getListingDetail } from "@/lib/get-listing-detail";
import { getT } from "@/lib/i18n/server";
import type { Listing } from "@/lib/mock-data";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function matching(list: Listing[], q: string): Listing[] {
  return list.filter((l) => {
    const d = getListingDetail(l.slug);
    return matchesBrowseQuery(`${l.title} ${l.categoryLabel} ${l.spaceType} ${d?.city ?? ""} ${d?.zone ?? ""}`, q);
  });
}

export default async function AlojamientosPage({ searchParams }: Props) {
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const tipo = one("tipo") || undefined;
  const vista = one("vista");
  const q = one("q");
  const t = await getT();
  const query = q.trim();
  const filters = parseBrowseFilters(sp);
  const verifiedOnly = one("verif") === "1";
  const filterCount = activeFilterCount(filters) + (verifiedOnly ? 1 : 0);
  let items = getBrowseListings(tipo);
  if (query) {
    items = matching(items, query);
    if (tipo && items.length === 0) items = matching(getBrowseListings(undefined), query);
  }
  items = items.filter((l) => {
    const d = getListingDetail(l.slug);
    if (verifiedOnly && !(d?.identityVerified ?? l.identityVerified)) return false;
    return matchesBrowseFilters(
      {
        pricePerNight: l.pricePerNight,
        guests: l.guests,
        bedrooms: l.bedrooms,
        spaceType: l.spaceType,
        amenities: d?.amenities ?? [],
        bookable: listingIsBookable(l.id),
      },
      filters
    );
  });
  const title = t((tipo && BROWSE_TITLES[tipo.toLowerCase()]) || "Alojamientos");
  const mapView = vista === "mapa";
  const mapItems = items.flatMap((l) => {
    const d = getListingDetail(l.slug);
    if (d?.lat == null || d.lng == null) return [];
    if (Math.abs(d.lat) < 0.01 && Math.abs(d.lng) < 0.01) return [];
    return [
      {
        id: l.id,
        href: `/listings/${l.slug}`,
        title: l.title,
        subtitle: [d.city, d.zone].filter(Boolean).join(", "),
        imageSrc: l.imageSrc,
        pricePerNight: l.pricePerNight,
        rating: l.rating,
        identityVerified: Boolean(d.identityVerified ?? l.identityVerified),
        lat: d.lat,
        lng: d.lng,
      },
    ];
  });
  const toggleHref = (() => {
    const p = new URLSearchParams();
    if (tipo) p.set("tipo", tipo);
    if (q) p.set("q", q);
    if (verifiedOnly) p.set("verif", "1");
    writeBrowseFilters(filters, p);
    if (!mapView) p.set("vista", "mapa");
    const s = p.toString();
    return s ? `/alojamientos?${s}` : "/alojamientos";
  })();

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-white" style={{ paddingTop: "88px" }}>
        <div className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6 lg:px-8">
          <Link href="/" className="text-sm font-medium" style={{ color: "#dcb81e" }}>
            ← {t("Inicio")}
          </Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold text-[#484848]">{title}</h1>
              <div className="mt-2 h-1 w-16" style={{ backgroundColor: "#dcb81e" }} />
              <p className="mt-3 text-sm text-[#3a3a3a]">
                {items.length === 1 ? t("1 listado") : t("{n} listados", { n: items.length })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <FilterButton
                basePath="/alojamientos"
                params={Object.fromEntries(Object.keys(sp).map((k) => [k, one(k)]))}
                priceRange={appPriceRange()}
                className="py-2.5 text-sm"
              />
              <Link
                href={toggleHref}
                className="rounded-full bg-[#222] px-5 py-2.5 text-sm font-semibold text-white lg:hidden"
              >
                {mapView ? t("Ver lista") : t("Ver mapa")}
              </Link>
            </div>
          </div>

          {items.length === 0 ? (
            filterCount > 0 ? (
              <div className="mt-10 text-sm text-[#3a3a3a]">
                <p>{t("Prueba subir el precio o quitar algunos filtros.")}</p>
                <Link
                  href={tipo ? `/alojamientos?tipo=${encodeURIComponent(tipo)}` : "/alojamientos"}
                  className="mt-3 inline-block font-semibold underline"
                >
                  {t("Quitar filtros")}
                </Link>
              </div>
            ) : (
              <p className="mt-10 text-sm text-[#3a3a3a]">{t("Todavía no hay anuncios en esta categoría.")}</p>
            )
          ) : (
            <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className={`${mapView ? "hidden lg:grid" : "grid"} content-start gap-6 sm:grid-cols-2`}>
                {items.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
              <div className={`${mapView ? "block" : "hidden lg:block"}`}>
                <div className="overflow-hidden rounded-xl border border-[#ebebeb] lg:sticky lg:top-[100px]">
                  <LazySearchMap items={mapItems} height="calc(100vh - 140px)" />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
