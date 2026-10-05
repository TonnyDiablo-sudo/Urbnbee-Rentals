import "server-only";
import { type BrowseFilters, matchesBrowseFilters } from "@/lib/browse-filters";
import { matchesBrowseQuery } from "@/lib/browse-query";
import { BROWSE_TITLES, getBrowseListings } from "@/lib/browse-merge";
import { getListingDetail } from "@/lib/get-listing-detail";
import { getListingById } from "@/lib/marketplace-store";
import { listingHasEngine } from "@/lib/booking-engine-slots";
import { hostCanTakeBookingPayments } from "@/lib/host-stripe";
import type { Listing } from "@/lib/mock-data";

export type AppListingCard = {
  id: string;
  slug: string;
  title: string;
  imageSrc: string;
  pricePerNight: number;
  pricePerMonth?: number;
  rating: number;
  city: string;
  zone: string;
  spaceType: string;
  guests: number;
  bedrooms: number;
  amenities: string[];
  verified: boolean;
  identityVerified: boolean;
  /** Comprobante de domicilio revisado por Cabibee. */
  locationVerified: boolean;
  /** Pagó «Anuncio destacado». */
  featured: boolean;
  /** Se puede reservar dentro de Cabibee (anuncio real con motor de reservas activo). */
  bookable: boolean;
  /** Ubicación aproximada para el mapa; null si el anuncio no tiene coordenadas. */
  lat: number | null;
  lng: number | null;
};

/** Coordenadas útiles para el mapa (descarta 0,0 y valores fuera de rango). */
export function mapCoords(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (Math.abs(a) < 0.01 && Math.abs(b) < 0.01) return null;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return { lat: a, lng: b };
}

export const APP_BROWSE_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Todos" },
  ...["habitaciones", "casas", "departamentos", "cabanas", "vinedos", "mar", "albercas", "vistas", "tropical"].map(
    (key) => ({ key, label: BROWSE_TITLES[key] ?? key })
  ),
];

/** Sólo los anuncios de anfitriones reales pasan por el motor de reservas; los de muestra no. */
export function listingIsBookable(listingId: string): boolean {
  const record = getListingById(listingId);
  return Boolean(record?.published && listingHasEngine(record) && hostCanTakeBookingPayments(record.hostId));
}

export function appBrowseListings(opts: {
  tipo?: string;
  q?: string;
  verifiedOnly?: boolean;
  filters?: BrowseFilters;
}): AppListingCard[] {
  const f = opts.filters;
  return browseCards(opts).filter(
    (c) => (!opts.verifiedOnly || c.identityVerified) && (!f || matchesBrowseFilters(c, f))
  );
}

/** Todos los anuncios, para buscar uno por su slug (favoritos y viajes). */
export function appListingsBySlug(): Map<string, AppListingCard> {
  const out = new Map<string, AppListingCard>();
  for (const f of APP_BROWSE_FILTERS) {
    for (const c of browseCards({ tipo: f.key })) if (!out.has(c.slug)) out.set(c.slug, c);
  }
  return out;
}

/** Igual, con la tarjeta del sitio web. */
export function webListingsBySlug(): Map<string, Listing> {
  const out = new Map<string, Listing>();
  for (const f of APP_BROWSE_FILTERS) {
    for (const l of getBrowseListings(f.key || undefined)) if (!out.has(l.slug)) out.set(l.slug, l);
  }
  return out;
}

export type PriceRange = { min: number; max: number; histogram: number[] };

const HISTOGRAM_BARS = 30;

/** Rango de precios por noche y cuántos anuncios caen en cada tramo, para la barra del filtro. */
export function appPriceRange(): PriceRange {
  const prices = browseCards({})
    .map((c) => c.pricePerNight)
    .filter((n) => n > 0);
  if (!prices.length) return { min: 0, max: 0, histogram: [] };
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const histogram = new Array<number>(HISTOGRAM_BARS).fill(0);
  const span = Math.max(1, max - min);
  for (const p of prices) histogram[Math.min(HISTOGRAM_BARS - 1, Math.floor(((p - min) / span) * HISTOGRAM_BARS))]++;
  return { min, max, histogram };
}

function browseCards(opts: { tipo?: string; q?: string }): AppListingCard[] {
  const q = opts.q?.trim() ?? "";
  const build = (tipo?: string) => {
    const seen = new Set<string>();
    const cards: AppListingCard[] = [];
    for (const l of getBrowseListings(tipo || undefined)) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      const detail = getListingDetail(l.slug);
      const text = `${l.title} ${l.categoryLabel} ${l.spaceType} ${detail?.city ?? ""} ${detail?.zone ?? ""}`;
      if (q && !matchesBrowseQuery(text, q)) continue;
      const coords = mapCoords(detail?.lat, detail?.lng);
      cards.push({
        id: l.id,
        slug: l.slug,
        title: l.title,
        imageSrc: l.imageSrc,
        pricePerNight: l.pricePerNight,
        pricePerMonth: l.pricePerMonth,
        rating: l.rating,
        city: detail?.city ?? "",
        zone: detail?.zone ?? "",
        spaceType: l.spaceType,
        guests: l.guests,
        bedrooms: l.bedrooms,
        amenities: detail?.amenities ?? [],
        verified: Boolean(l.verified),
        identityVerified: Boolean(detail?.identityVerified ?? l.identityVerified),
        locationVerified: Boolean(detail?.locationVerified ?? l.locationVerified),
        featured: Boolean(l.featured),
        bookable: listingIsBookable(l.id),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      });
    }
    return cards;
  };

  const matched = build(opts.tipo);
  if (q && opts.tipo && matched.length === 0) return build(undefined);
  return matched;
}
