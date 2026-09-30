import "server-only";
import type { Listing, ListingCategory } from "@/lib/mock-data";
import { demoListings, demoListingsForTipo } from "@/lib/mock-data";
import type { HostListingRecord } from "@/lib/marketplace-types";
import { getPublishedByCategory } from "@/lib/marketplace-store";
import { hostListingToDetail } from "@/lib/host-listing-mapper";
import { listingStayRating } from "@/lib/stay-reviews-store";

function hostToListingCard(categoryLabel: string, record: HostListingRecord): Listing {
  const d = hostListingToDetail(record);
  const cover =
    d.photos[0] ||
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80";
  return {
    id: d.id,
    slug: d.slug,
    title: d.title,
    imageSrc: cover,
    pricePerNight: d.pricePerNight,
    currency: "$",
    rating: listingStayRating(record.id).avg,
    categoryLabel,
    spaceType: d.spaceType,
    guests: d.guests,
    bedrooms: d.bedrooms,
    bathrooms: d.bathrooms,
    verified: d.verified,
  };
}

/** Anuncios de prueba de integraciones: se abren por enlace directo, pero no salen en búsquedas. */
function isTestListing(record: HostListingRecord): boolean {
  return /\bprueba\b|no reservar/i.test(record.title);
}

/** Merge demo listings with published host listings (host items first). */
export function getMergedCategoryListings(category: ListingCategory): Listing[] {
  const labelForCategory: Record<ListingCategory, string> = {
    habitaciones: "Habitaciones",
    casas: "Casas",
    departamentos: "Departamentos",
    cabanas: "Cabañas",
    vinos: "Viñedos",
  };
  const label = labelForCategory[category];
  const hostRows = getPublishedByCategory(category)
    .filter((r) => !isTestListing(r))
    .map((r) => hostToListingCard(label, r));
  const demo = demoListings[category] ?? [];
  return [...hostRows, ...demo];
}

const TIPO_CATEGORY: Record<string, ListingCategory> = {
  habitaciones: "habitaciones",
  casas: "casas",
  departamentos: "departamentos",
  cabanas: "cabanas",
  vinedos: "vinos",
  vinos: "vinos",
};

export const BROWSE_TITLES: Record<string, string> = {
  habitaciones: "Habitaciones",
  casas: "Casas",
  departamentos: "Departamentos",
  cabanas: "Cabañas",
  vinedos: "Viñedos",
  vinos: "Viñedos",
  vistas: "Vistas increíbles",
  tropical: "Tropical",
  mar: "Frente al mar",
  albercas: "Albercas",
};

/** Listados de una categoría o de un filtro (vistas, tropical, mar, albercas). */
export function getBrowseListings(tipo?: string): Listing[] {
  const key = (tipo ?? "").toLowerCase();
  const category = TIPO_CATEGORY[key];
  if (category) return getMergedCategoryListings(category);
  if (!key) {
    return (Object.keys(demoListings) as ListingCategory[]).flatMap((c) => getMergedCategoryListings(c));
  }
  return demoListingsForTipo(key);
}

export function getMergedHomeSections(): Record<ListingCategory, Listing[]> {
  return {
    habitaciones: getMergedCategoryListings("habitaciones"),
    casas: getMergedCategoryListings("casas"),
    departamentos: getMergedCategoryListings("departamentos"),
    cabanas: getMergedCategoryListings("cabanas"),
    vinos: getMergedCategoryListings("vinos"),
  };
}
