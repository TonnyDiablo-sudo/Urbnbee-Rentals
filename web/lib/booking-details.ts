import "server-only";
import type { ArrivalGuide } from "@/lib/arrival-guide";
import { bookingBalanceDueMxn, paidStayOf } from "@/lib/booking-adjustments";
import { applyBookingLifecycle } from "@/lib/booking-deposit";
import type { BookingRecord } from "@/lib/booking-types";
import { publicNameOf } from "@/lib/display-name";
import { listingFullAddress } from "@/lib/listing-address";
import { findUserById, getHostProfile, getListingById } from "@/lib/marketplace-store";
import { isHostIdentityVerified } from "@/lib/verification-store";

export type BookingDetailsRole = "host" | "guest" | "companion";

export type BookingDetails = {
  role: BookingDetailsRole;
  id: string;
  token: string;
  status: string;
  createdAt: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  checkInTime?: string;
  checkOutTime?: string;
  guestCount?: number;
  /** Quien reserva primero; después los acompañantes. */
  people: { name: string; booker: boolean; hasAccount: boolean }[];
  booker: {
    name: string;
    email?: string;
    phone?: string;
    identityVerified: boolean;
    memberSince?: string;
    avatarUrl?: string;
  };
  host: { name: string; avatarUrl?: string; phone?: string };
  listing: { id: string; title: string; slug?: string; photo?: string; city?: string; lat?: number; lng?: number };
  cost: {
    stayMxn: number;
    cleaningMxn: number;
    taxMxn: number;
    taxIncluded: boolean;
    taxLines: { name: string; ratePct: number; amountMxn: number }[];
    platformFeeMxn: number;
    totalMxn: number;
    paidAt?: string;
    paidMxn: number;
    balanceDueMxn: number;
    refundedAt?: string;
    refundedMxn: number;
    method?: string;
  };
  contract: { status: string; hostSignedAt?: string; guestSignedAt?: string; url: string } | null;
  /** Dirección exacta, mapa y claves: sólo con la reserva confirmada. */
  arrival?: ArrivalGuide & { address: string; exact: boolean };
  deposit?: { amountMxn: number; status: string; note: string };
  guestNotes?: string;
};

const LIVE = new Set(["CONFIRMED", "COMPLETED"]);

export function bookingRoleFor(userId: string, b: BookingRecord): "guest" | "companion" | null {
  if (b.guestUserId === userId) return "guest";
  if (b.party?.some((p) => p.userId === userId)) return "companion";
  return null;
}

export function bookingDetails(raw: BookingRecord, role: BookingDetailsRole): BookingDetails {
  const b = applyBookingLifecycle(raw);
  const effId = b.hostAdjustedListingId ?? b.listingId;
  const listing = getListingById(effId) ?? getListingById(b.listingId);
  const guide = listing?.arrivalGuide ?? {};
  const live = LIVE.has(b.status);
  const guestUser = b.guestUserId ? findUserById(b.guestUserId) : undefined;
  const hostUser = findUserById(b.hostId);
  const hostProfile = getHostProfile(b.hostId);
  const guestProfile = b.guestUserId ? getHostProfile(b.guestUserId) : undefined;

  const taxMxn = b.taxMxn ?? 0;
  const taxIncluded = b.taxIncluded === true;
  const cleaningMxn = b.cleaningFeeMxn ?? 0;
  const platformFeeMxn = b.platformFeeMxn ?? 0;
  const stayMxn = Math.max(0, b.estimatedTotalMxn - cleaningMxn - (taxIncluded ? 0 : taxMxn));
  const refundedMxn =
    (b.refundAmountMxn ?? (b.refundedAt ? paidStayOf(b) : 0)) +
    (b.adjustments ?? []).filter((a) => a.kind === "refund" && a.status === "refunded").reduce((s, a) => s + a.amountMxn + a.feeMxn, 0);
  const method = b.payConfirmation?.method ?? (b.stripeCheckoutSessionId ? "stripe" : undefined);

  const people = [
    { name: b.guestName, booker: true, hasAccount: Boolean(b.guestUserId) },
    ...(b.party ?? []).map((p) => ({ name: p.name, booker: false, hasAccount: Boolean(p.userId) })),
  ];

  return {
    role,
    id: b.id,
    token: b.token,
    status: b.status,
    createdAt: b.createdAt,
    checkIn: b.hostAdjustedCheckIn ?? b.checkIn,
    checkOut: b.hostAdjustedCheckOut ?? b.checkOut,
    nights: b.nights,
    checkInTime: guide.checkInTime,
    checkOutTime: guide.checkOutTime,
    guestCount: b.guestCount,
    people,
    booker: {
      name: b.guestName,
      email: role === "host" || role === "guest" ? b.guestEmail : undefined,
      phone: role === "host" || role === "guest" ? b.guestPhone : undefined,
      identityVerified: b.guestUserId ? isHostIdentityVerified(b.guestUserId) : false,
      memberSince: role === "host" ? guestUser?.createdAt : undefined,
      avatarUrl: guestProfile?.avatarUrl || undefined,
    },
    host: {
      name: publicNameOf(hostUser) || "Anfitrión",
      avatarUrl: hostProfile?.avatarUrl || undefined,
      phone: role !== "host" && live ? hostUser?.phone : undefined,
    },
    listing: {
      id: effId,
      title: listing?.title ?? "Alojamiento",
      slug: listing?.slug,
      photo: listing?.photos?.[0],
      city: listing?.city,
      lat: live || role === "host" ? listing?.lat : undefined,
      lng: live || role === "host" ? listing?.lng : undefined,
    },
    cost: {
      stayMxn,
      cleaningMxn,
      taxMxn,
      taxIncluded,
      taxLines: b.taxLines ?? [],
      platformFeeMxn,
      totalMxn: b.estimatedTotalMxn,
      paidAt: b.paidAt,
      paidMxn: paidStayOf(b),
      balanceDueMxn: bookingBalanceDueMxn(b),
      refundedAt: b.refundedAt,
      refundedMxn,
      method,
    },
    contract: b.contract
      ? {
          status: b.contractStatus ?? (b.contract.guestAcceptedAt && b.contract.hostAcceptedAt ? "signed" : "pending"),
          hostSignedAt: b.contract.hostAcceptedAt,
          guestSignedAt: b.contract.guestAcceptedAt,
          url: `/contrato/${b.token}`,
        }
      : null,
    arrival:
      live && listing
        ? { ...guide, address: listingFullAddress(listing), exact: true }
        : undefined,
    deposit: b.deposit ? { amountMxn: b.deposit.amountMxn, status: b.deposit.status, note: b.deposit.note } : undefined,
    guestNotes: role === "host" ? b.guestFinishNotes : undefined,
  };
}
