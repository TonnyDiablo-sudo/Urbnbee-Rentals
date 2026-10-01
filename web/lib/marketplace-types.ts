import type { ArrivalGuide } from "@/lib/arrival-guide";
import type { ListingContractSettings } from "@/lib/booking-contract-templates";
import type { ListingPricing } from "@/lib/listing-pricing";
import type { ListingCategory } from "@/lib/mock-data";
import type { ListingDetail } from "@/lib/listing-detail-data";
import type { HostTaxSettings } from "@/lib/stay-tax";

export type UserRole = "guest" | "host" | "admin";

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  /** Nombre público en anuncios y chat. En reservas y contratos se usa fullName. */
  alias?: string;
  /** Si es true y hay alias, anuncios y chat muestran el alias. */
  showAlias?: boolean;
  /** La identidad ya se comprobó: fullName no se vuelve a editar, aunque cancele la membresía. */
  legalNameLocked?: boolean;
  phone?: string;
  /** Dirección para el contrato (cuenta). */
  addressLine?: string;
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
  /** A qué se dedica («Diseñadora», «Estudiante de medicina»). */
  work?: string;
  /** Ciudad donde vive. */
  livesIn?: string;
  languages?: string[];
  interests?: string[];
  /** IVA / impuestos que el anfitrión cobra al huésped. */
  tax?: HostTaxSettings;
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
  /** Fin de semana, descuentos por duración y estancia mínima/máxima. */
  pricing?: ListingPricing;
  arrivalGuide?: ArrivalGuide;
  photos: string[];
  amenities: string[];
  rules: ListingDetail["rules"];
  blockedDates: string[];
  /** Platform badges — new host listings start unverified */
  verified: boolean;
  published: boolean;
  /**
   * instant: si Stripe confirma el pago, la reserva queda aceptada sin paso del anfitrión.
   * approval: el anfitrión acepta a mano y entonces el huésped recibe contrato, pago y, si aplica, el crédito.
   */
  bookingApprovalMode: "instant" | "approval";
  /** Si hace falta una consulta de crédito para seguir con la reserva. */
  requireCreditCheck?: boolean;
  /** Quién paga esa consulta. Por defecto el huésped. */
  creditCheckPayer?: "host" | "guest";
  /**
   * false: este anuncio no cobra los impuestos del anfitrión. Con reserva por
   * aprobación es solo el valor inicial: el anfitrión decide al aceptar.
   */
  chargeTax?: boolean;
  /** Plantilla y datos que el anfitrión usa para celebrar el contrato de cada reserva. */
  contract?: ListingContractSettings;
  createdAt: string;
  updatedAt: string;
};

export type SessionPayload = {
  sub: string;
  email: string;
  role: UserRole;
  exp: number;
};
