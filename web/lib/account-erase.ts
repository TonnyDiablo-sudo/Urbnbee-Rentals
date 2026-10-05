import "server-only";
import { listBookingsForGuest, listBookingsForHost, patchBookingRecord } from "@/lib/bookings-store";
import type { BookingRecord } from "@/lib/booking-types";
import { deleteHostEntitlements } from "@/lib/host-entitlements-store";
import { deleteMessagesForAccount } from "@/lib/host-inbox-store";
import { deleteHostPaymentSecrets } from "@/lib/host-payment-store";
import { deleteHostPayoutMethods } from "@/lib/host-payout-methods";
import { eraseUserRecord, findUserById } from "@/lib/marketplace-store";
import { removeSubscriptionsForUser } from "@/lib/push-store";
import { deleteReportsForAccount } from "@/lib/user-reports-store";
import { deleteVerification } from "@/lib/verification-store";

const OPEN = new Set(["AWAITING_PAYMENT", "PENDING", "PENDING_HOST", "AWAITING_DETAILS", "CONFIRMED"]);

function scrubBooking(booking: BookingRecord, userId: string): void {
  const wasGuest = booking.guestUserId === userId;
  const wasHost = booking.hostId === userId;
  const contract = booking.contract
    ? {
        ...booking.contract,
        snapshot: {
          ...booking.contract.snapshot,
          ...(wasGuest
            ? { guestName: "Cuenta eliminada", guestEmail: "", guestPhone: "", guestAddress: "" }
            : {}),
          ...(wasHost
            ? { hostLegalName: "Cuenta eliminada", hostEmail: "", hostPhone: "", hostAddress: "" }
            : {}),
        },
      }
    : undefined;
  patchBookingRecord(booking.id, {
    ...(OPEN.has(booking.status) ? { status: "CANCELLED" } : {}),
    ...(wasGuest
      ? { guestUserId: undefined, guestName: "Cuenta eliminada", guestEmail: "", guestPhone: "" }
      : {}),
    ...(contract ? { contract } : {}),
  });
}

/** Borra la cuenta y los datos personales. Las reservas quedan, sin nombres ni contacto. */
export function eraseAccount(userId: string): boolean {
  const user = findUserById(userId);
  if (!user || user.role === "admin") return false;
  const seen = new Set<string>();
  for (const booking of [...listBookingsForHost(userId), ...listBookingsForGuest(userId)]) {
    if (seen.has(booking.id)) continue;
    seen.add(booking.id);
    scrubBooking(booking, userId);
  }
  deleteMessagesForAccount(userId);
  deleteHostPayoutMethods(userId);
  deleteHostPaymentSecrets(userId);
  deleteHostEntitlements(userId);
  deleteVerification(userId);
  removeSubscriptionsForUser(userId);
  deleteReportsForAccount(userId);
  return eraseUserRecord(userId);
}
