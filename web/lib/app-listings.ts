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
  /** Se puede reservar dentro de Cabibee (anuncio real con motor de reservas activo). */
  bookable: boolean;
};

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

export function appBrowseListings(opts: { tipo?: string; q?: string }): AppListingCard[] {
  const seen = new Set<string>();
  const cards: AppListingCard[] = [];
  for (const l of getBrowseListings(opts.tipo || undefined)) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    const detail = getListingDetail(l.slug);
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
      bookable: listingIsBookable(l.id),
    });
  }

  const q = normalize(opts.q?.trim() ?? "");
  if (!q) return cards;
  return cards.filter((c) =>
    normalize(`${c.title} ${c.city} ${c.zone} ${c.spaceType}`).includes(q)
  );
}
