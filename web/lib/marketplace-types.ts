import type { ListingCategory } from "@/lib/mock-data";
import type { ListingDetail } from "@/lib/listing-detail-data";

export type UserRole = "guest" | "host" | "admin";

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  createdAt: string;
};

/** Contact & bio shown on listing detail — scoped per host (tenant). */
export type HostProfileRecord = {
  userId: string;
  bio: string;
  avatarUrl?: string;
  whatsapp?: string;
  phone?: string;
  /** Public email for guests (can differ from login email) */
  email?: string;
  instagram?: string;
  website?: string;
  airbnbUrl?: string;
};

export type HostListingRecord = {
  id: string;
  hostId: string;
  slug: string;
  title: string;
  description: string;
  categoryKey: ListingCategory;
  spaceType: string;
  city: string;
  zone: string;
  county: string;
  country: string;
  addressLine: string;
  lat: number;
  lng: number;
  guests: number;
  bedrooms: number;
  bathrooms: number;
  size?: string;
  pricePerNight: number;
  cleaningFee: number;
  /** Precio por noche para fechas concretas (YYYY-MM-DD). Si falta la clave, aplica `pricePerNight`. */
  nightlyPriceOverrides?: Record<string, number>;
  photos: string[];
  amenities: string[];
  rules: ListingDetail["rules"];
  blockedDates: string[];
  /** Platform badges — new host listings start unverified */
  verified: boolean;
  published: boolean;
  /**
   * instant: tras pagar, la reserva queda confirmada sin paso del anfitrión.
   * approval: tras pagar, queda pendiente hasta que el anfitrión acepte o rechace.
   */
  bookingApprovalMode: "instant" | "approval";
  createdAt: string;
  updatedAt: string;
};

export type SessionPayload = {
  sub: string;
  email: string;
  role: UserRole;
  exp: number;
};
