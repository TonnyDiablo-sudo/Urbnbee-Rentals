import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ListingCard } from "@/components/listing-card";
import { LazySearchMap } from "@/components/search/search-map-lazy";
import { appBrowseListings } from "@/lib/app-listings";
import { BROWSE_TITLES, getBrowseListings } from "@/lib/browse-merge";
import { getT } from "@/lib/i18n/server";

type Props = { searchParams: Promise<{ tipo?: string; vista?: string }> };

export default async function AlojamientosPage({ searchParams }: Props) {
  const { tipo, vista } = await searchParams;
  const t = await getT();
  const items = getBrowseListings(tipo);
  const title = t((tipo && BROWSE_TITLES[tipo.toLowerCase()]) || "Alojamientos");
  const mapView = vista === "mapa";
  const mapItems = appBrowseListings({ tipo })
    .filter((l) => l.lat !== null && l.lng !== null)
    .map((l) => ({
      id: l.id,
      href: `/listings/${l.slug}`,
      title: l.title,
      subtitle: [l.city, l.zone].filter(Boolean).join(", "),
      imageSrc: l.imageSrc,
      pricePerNight: l.pricePerNight,
      rating: l.rating,
      identityVerified: l.identityVerified,
      lat: l.lat as number,
      lng: l.lng as number,
    }));
  const toggleHref = (() => {
    const p = new URLSearchParams();
    if (tipo) p.set("tipo", tipo);
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
            <Link
              href={toggleHref}
              className="rounded-full bg-[#222] px-5 py-2.5 text-sm font-semibold text-white lg:hidden"
            >
              {mapView ? t("Ver lista") : t("Ver mapa")}
            </Link>
          </div>

          {items.length === 0 ? (
            <p className="mt-10 text-sm text-[#3a3a3a]">{t("Todavía no hay anuncios en esta categoría.")}</p>
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
