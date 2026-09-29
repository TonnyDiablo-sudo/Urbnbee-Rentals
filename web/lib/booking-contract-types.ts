import type { BookingContractTemplateId } from "@/lib/booking-contract-templates";

export const BOOKING_CONTRACT_TEMPLATE_ID = "cabibee_reserva_v1" as const;

export type BookingContractActor = "host" | "guest" | "system" | "admin";

export type BookingContractEvent = {
  at: string;
  actor: BookingContractActor;
  action: string;
  detail?: string;
  ip?: string;
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
  /** 0 si el anfitrión no declaró depósito. Cabibee no lo retiene. */
  depositMxn: number;
  depositNote: string;
  extraClauses: string;
  rules: {
    smoking: boolean | null;
    pets: boolean | null;
    parties: boolean | null;
    children: boolean | null;
  };
  cancellationPolicy: string;
  facilitatorNote: string;
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
  events: BookingContractEvent[];
};
