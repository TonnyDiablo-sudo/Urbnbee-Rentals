import "server-only";
import type { HostListingRecord } from "@/lib/marketplace-types";
import type { ListingDetail } from "@/lib/listing-detail-data";
import { findUserById, getHostProfile } from "@/lib/marketplace-store";

const PLACEHOLDER =
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80";

function hashPropertyId(listingId: string): number {
  let h = 0;
  for (let i = 0; i < listingId.length; i++) h = (h * 31 + listingId.charCodeAt(i)) >>> 0;
  return 100000 + (h % 900000);
}

function categoryLabel(key: HostListingRecord["categoryKey"]): string {
  const m: Record<HostListingRecord["categoryKey"], string> = {
    habitaciones: "Habitaciones",
    casas: "Casas",
    departamentos: "Departamentos",
    cabanas: "Cabañas",
    vinos: "Viñedos",
  };
  return m[key];
}

export function hostListingToDetail(record: HostListingRecord): ListingDetail {
  const user = findUserById(record.hostId);
  const profile = getHostProfile(record.hostId);
  const photos = record.photos.length ? record.photos : [PLACEHOLDER];

  const hostName = user?.fullName ?? "Anfitrión";
  const host: ListingDetail["host"] = {
    name: hostName,
    bio: profile?.bio?.trim() || `${hostName} es anfitrión en Urbnbee.`,
    avatarUrl:
      profile?.avatarUrl ||
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&q=80",
    whatsapp: profile?.whatsapp,
    phone: profile?.phone,
    email: profile?.email || user?.email,
    instagram: profile?.instagram,
    website: profile?.website,
    airbnbUrl: profile?.airbnbUrl,
  };

  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description || "Sin descripción todavía.",
    city: record.city || "—",
    zone: record.zone || "—",
    county: record.county || "",
    country: record.country || "",
    lat: record.lat,
    lng: record.lng,
    pricePerNight: record.pricePerNight,
    nightlyPriceOverrides: record.nightlyPriceOverrides
      ? { ...record.nightlyPriceOverrides }
      : undefined,
    cleaningFee: record.cleaningFee,
    category: categoryLabel(record.categoryKey),
    spaceType: record.spaceType,
    guests: record.guests,
    bedrooms: record.bedrooms,
    bathrooms: record.bathrooms,
    size: record.size,
    verified: record.verified,
    propertyId: hashPropertyId(record.id),
    blockedDates: [...record.blockedDates],
    photos,
    amenities: record.amenities.length
      ? record.amenities
      : ["Internet Inalámbrico", "Agua caliente", "Elementos básicos"],
    rules: record.rules,
    host,
    reviews: [],
  };
}
