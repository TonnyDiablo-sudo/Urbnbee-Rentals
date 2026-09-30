import "server-only";
import type { BookingRecord } from "@/lib/booking-types";
import { getVerification, resolveGuestBookingAccess } from "@/lib/verification-store";

export type GuestNextStep = "register" | "membership" | "identity" | "contract" | "pay" | null;

export function firstGuestName(full: string | undefined): string {
  const t = (full ?? "").trim();
  return t.split(/\s+/)[0] || "Huésped";
}

export function guestRequirementsOf(booking: BookingRecord | undefined, origin: string) {
  if (!booking) {
    return {
      has_account: false,
      membership_active: false,
      identity_verified: false,
      contract_signed: false,
      next_step: "register" as GuestNextStep,
      next_step_url: `${origin}/register`,
    };
  }

  const hasAccount = Boolean(booking.guestUserId);
  const access = booking.guestUserId
    ? resolveGuestBookingAccess(booking.guestUserId)
    : { allowed: false, via: "open" as const, needsMembership: true, needsIdentity: false };
  const v = booking.guestUserId ? getVerification(booking.guestUserId) : undefined;
  const membershipActive = Boolean(
    hasAccount && (!access.needsMembership || booking.usedMembershipPass)
  );
  const identityVerified = Boolean(hasAccount && (v?.kycStatus === "verified" || !access.needsIdentity));
  const contractSigned = Boolean(booking.contract?.guestAcceptedAt);
  const unpaid = booking.status === "AWAITING_PAYMENT";

  let next_step: GuestNextStep = null;
  let next_step_url: string | null = null;
  if (!hasAccount) {
    next_step = "register";
    next_step_url = `${origin}/register?next=${encodeURIComponent(`/contrato/${booking.token}?pay=1`)}`;
  } else if (unpaid && !contractSigned) {
    next_step = "contract";
    next_step_url = `${origin}/contrato/${booking.token}?pay=1`;
  } else if (unpaid) {
    next_step = "pay";
    next_step_url = `${origin}/contrato/${booking.token}?pay=1`;
  } else if (!contractSigned) {
    next_step = "contract";
    next_step_url = `${origin}/contrato/${booking.token}`;
  }

  return {
    has_account: hasAccount,
    membership_active: Boolean(hasAccount && membershipActive),
    identity_verified: Boolean(hasAccount && identityVerified),
    contract_signed: contractSigned,
    next_step,
    next_step_url,
  };
}
