import "server-only";
import type { Listing, ListingCategory } from "@/lib/mock-data";
import { demoListings, demoListingsForTipo } from "@/lib/mock-data";
import type { HostListingRecord } from "@/lib/marketplace-types";
import { getPublishedByCategory } from "@/lib/marketplace-store";
import { hostListingToDetail } from "@/lib/host-listing-mapper";
import { listingStayRating } from "@/lib/stay-reviews-store";
import { listingIsFeatured } from "@/lib/featured-slots";

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
    identityVerified: d.identityVerified,
    locationVerified: d.locationVerified,
    featured: listingIsFeatured(record),
  };
}

/** Los anuncios destacados (pagados) van primero; el resto conserva su orden. */
function featuredFirst(items: Listing[]): Listing[] {
  return [...items.filter((l) => l.featured), ...items.filter((l) => !l.featured)];
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
  return featuredFirst([...hostRows, ...demo]);
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

const ALL_CATEGORIES: ListingCategory[] = ["habitaciones", "casas", "departamentos", "cabanas", "vinos"];

const TROPICAL_CITIES = /tulum|playa del carmen|canc[uú]n|holbox|bacalar|puerto vallarta|sayulita|huatulco|zihuatanejo|acapulco|mazatl[aá]n|puerto escondido/i;

const TIPO_MATCH: Record<string, (r: HostListingRecord, text: string) => boolean> = {
  mar: (_r, text) => /\bplaya\b|frente al mar|al mar\b|bah[ií]a|pac[ií]fico|caribe|oc[eé]ano/.test(text),
  albercas: (r, text) => r.amenities.includes("Piscina") || /alberca|piscina/.test(text),
  vistas: (_r, text) => /vista|ventanal|acantilado|mirador/.test(text),
  tropical: (r, text) => TROPICAL_CITIES.test(r.city) || /selva|cenote|palapa|tropical/.test(text),
};

/** Listados de una categoría o de un filtro (vistas, tropical, mar, albercas). */
export function getBrowseListings(tipo?: string): Listing[] {
  const key = (tipo ?? "").toLowerCase();
  const category = TIPO_CATEGORY[key];
  if (category) return getMergedCategoryListings(category);
  if (!key) {
    return featuredFirst((Object.keys(demoListings) as ListingCategory[]).flatMap((c) => getMergedCategoryListings(c)));
  }
  const match = TIPO_MATCH[key];
  if (!match) return demoListingsForTipo(key);
  const label = BROWSE_TITLES[key] ?? key;
  const hostRows = ALL_CATEGORIES.flatMap((c) => getPublishedByCategory(c))
    .filter((r) => !isTestListing(r) && match(r, `${r.title} ${r.description}`.toLowerCase()))
    .map((r) => hostToListingCard(label, r));
  return featuredFirst([...hostRows, ...demoListingsForTipo(key)]);
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
