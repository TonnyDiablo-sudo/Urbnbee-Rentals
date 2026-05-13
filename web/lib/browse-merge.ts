import "server-only";
import type { Listing, ListingCategory } from "@/lib/mock-data";
import { demoListings } from "@/lib/mock-data";
import type { HostListingRecord } from "@/lib/marketplace-types";
import { getPublishedByCategory } from "@/lib/marketplace-store";
import { hostListingToDetail } from "@/lib/host-listing-mapper";

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
    rating: 0,
    categoryLabel,
    spaceType: d.spaceType,
    guests: d.guests,
    bedrooms: d.bedrooms,
    bathrooms: d.bathrooms,
    verified: d.verified,
  };
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
  const hostRows = getPublishedByCategory(category).map((r) => hostToListingCard(label, r));
  const demo = demoListings[category] ?? [];
  return [...hostRows, ...demo];
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
