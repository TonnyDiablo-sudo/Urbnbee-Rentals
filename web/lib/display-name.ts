import "server-only";
import type { UserRecord } from "@/lib/marketplace-types";
import { findUserById, updateUser } from "@/lib/marketplace-store";
import { listBookingsForGuest } from "@/lib/bookings-store";
import { getVerification } from "@/lib/verification-store";

/** Identidad comprobada, o ya bloqueada antes. Cancelar la membresía no lo abre. */
export function isLegalNameLocked(userId: string): boolean {
  const user = findUserById(userId);
  if (user?.legalNameLocked) return true;
  const v = getVerification(userId);
  return v?.kycStatus === "verified" || Boolean(v?.hostVerifiedAt);
}

/** Fija el nombre del documento y lo deja cerrado. */
export function lockLegalName(userId: string, fromDocument?: string): void {
  const name = fromDocument?.replace(/\s+/g, " ").trim();
  updateUser(
    userId,
    {
      legalNameLocked: true,
      ...(name && name.length >= 2 ? { fullName: name.slice(0, 120) } : {}),
    },
    { forceLegalName: true }
  );
}

/** Anuncios y chat. Con reserva entre las dos personas se usa el nombre real. */
export function publicNameOf(user: Pick<UserRecord, "fullName" | "alias" | "showAlias"> | undefined): string {
  if (!user) return "";
  if (user.showAlias && user.alias?.trim()) return user.alias.trim();
  return user.fullName.trim();
}

export function nameForViewer(userId: string, revealLegal: boolean): string {
  const user = findUserById(userId);
  if (!user) return "";
  return revealLegal ? user.fullName.trim() : publicNameOf(user);
}

export function shareABooking(hostId: string, guestUserId: string): boolean {
  if (!hostId || !guestUserId || hostId === guestUserId) return false;
  return listBookingsForGuest(guestUserId).some((b) => b.hostId === hostId);
}
