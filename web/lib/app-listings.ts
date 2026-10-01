import "server-only";
import { BROWSE_TITLES, getBrowseListings } from "@/lib/browse-merge";
import { getListingDetail } from "@/lib/get-listing-detail";
import { getListingById } from "@/lib/marketplace-store";
import { hostAcceptsBookings } from "@/lib/verification-store";

export type AppListingCard = {
  id: string;
  slug: string;
  title: string;
  imageSrc: string;
  pricePerNight: number;
  rating: number;
  city: string;
  zone: string;
  spaceType: string;
  guests: number;
  bedrooms: number;
  verified: boolean;
  identityVerified: boolean;
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
  return Boolean(record?.published && hostAcceptsBookings(record.hostId));
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function appBrowseListings(opts: { tipo?: string; q?: string; verifiedOnly?: boolean }): AppListingCard[] {
  const all = browseCards(opts);
  return opts.verifiedOnly ? all.filter((c) => c.identityVerified) : all;
}

function browseCards(opts: { tipo?: string; q?: string }): AppListingCard[] {
  const seen = new Set<string>();
  const cards: AppListingCard[] = [];
  for (const l of getBrowseListings(opts.tipo || undefined)) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    const detail = getListingDetail(l.slug);
    const coords = mapCoords(detail?.lat, detail?.lng);
    cards.push({
      id: l.id,
      slug: l.slug,
      title: l.title,
      imageSrc: l.imageSrc,
      pricePerNight: l.pricePerNight,
      rating: l.rating,
      city: detail?.city ?? "",
      zone: detail?.zone ?? "",
      spaceType: l.spaceType,
      guests: l.guests,
      bedrooms: l.bedrooms,
      verified: Boolean(l.verified),
      identityVerified: Boolean(detail?.identityVerified ?? l.identityVerified),
      bookable: listingIsBookable(l.id),
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    });
  }

  const q = normalize(opts.q?.trim() ?? "");
  if (!q) return cards;
  return cards.filter((c) =>
    normalize(`${c.title} ${c.city} ${c.zone} ${c.spaceType}`).includes(q)
  );
}
