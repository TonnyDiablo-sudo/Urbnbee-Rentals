import type { BookingContractTemplateId } from "@/lib/booking-contract-templates";

export const BOOKING_CONTRACT_TEMPLATE_ID = "cabibee_reserva_v1" as const;

export type BookingContractActor = "host" | "guest" | "system" | "admin";

export type BookingContractEvent = {
  at: string;
  actor: BookingContractActor;
  action: string;
  detail?: string;
  ip?: string;
  userAgent?: string;
};

export type BookingContractSnapshot = {
  templateId: BookingContractTemplateId | string;
  templateTitle: string;
  listingId: string;
  listingTitle: string;
  listingCity: string;
  listingZone: string;
  propertyAddress: string;
  hostId: string;
  hostLegalName: string;
  hostAddress: string;
  hostEmail: string;
  hostPhone: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestAddress: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  stayMxn: number;
  cleaningMxn: number;
  platformFeeMxn: number;
  totalMxn: number;
  /** Impuestos del anfitrión (IVA, hospedaje…). Faltan en contratos anteriores a esta función. */
  taxMxn?: number;
  taxLines?: { name: string; ratePct: number; amountMxn: number }[];
  taxIncluded?: boolean;
  hostTaxId?: string;
  /** 0 si el anfitrión no declaró depósito. Cabibee no lo retiene. */
  depositMxn: number;
  depositNote: string;
  extraClauses: string;
  /** Reglas escritas por el anfitrión al momento de generar el contrato. */
  houseRules?: string;
  rules: {
    smoking: boolean | null;
    pets: boolean | null;
    parties: boolean | null;
    children: boolean | null;
  };
  cancellationPolicy: string;
  /** Sólo en contratos con formato anterior; los nuevos usan `thirdPartyClause`. */
  facilitatorNote: string;
  /** 2 = contrato entre particulares con cláusulas por jurisdicción. Sin campo = formato anterior. */
  format?: 2;
  listingState?: string;
  listingCountry?: string;
  maxGuests?: number;
  jurisdiction?: {
    label: string;
    governingLaw: string;
    courts: string;
    clauses: { title: string; text: string }[];
  };
};

export type BookingContractRecord = {
  version: 1;
  templateId: BookingContractTemplateId | string;
  generatedAt: string;
  snapshot: BookingContractSnapshot;
  hostAcceptedAt?: string;
  hostAcceptedByUserId?: string;
  hostAcceptedName?: string;
  hostAcceptedIp?: string;
  guestAcceptedAt?: string;
  guestAcceptedName?: string;
  guestAcceptedIp?: string;
  guestAcceptedUserAgent?: string;
  /** Texto exacto que el huésped vio y aceptó (sin la firma posterior). */
  acceptedPlainText?: string;
  acceptedSha256?: string;
  /** Versiones reemplazadas por un cambio de fechas, anuncio o montos; conservan sus firmas. */
  previousVersions?: BookingContractPreviousVersion[];
  events: BookingContractEvent[];
};

export type BookingContractPreviousVersion = {
  generatedAt: string;
  supersededAt: string;
  snapshot: BookingContractSnapshot;
  hostAcceptedAt?: string;
  hostAcceptedName?: string;
  guestAcceptedAt?: string;
  guestAcceptedName?: string;
  acceptedSha256?: string;
  changes: string[];
};
