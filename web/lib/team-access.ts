import "server-only";
import { getHostEntitlement } from "@/lib/host-entitlements-store";
import { HOST_SKU_CLEANING, HOST_SKU_COLLABORATORS } from "@/lib/host-entitlement-types";
import type { BookingRecord } from "@/lib/booking-types";
import type { UserRecord } from "@/lib/marketplace-types";
import {
  activeMembership,
  listTeamForHost,
  memberCoversListing,
  memberNeedsSeat,
  type TeamMember,
  type TeamRole,
} from "@/lib/team-store";

const GRACE_MS = 2 * 24 * 60 * 60 * 1000;

export function paidUp(row: { status: string; currentPeriodEnd?: string } | undefined): boolean {
  if (!row || (row.status !== "active" && row.status !== "past_due")) return false;
  if (!row.currentPeriodEnd) return true;
  const t = Date.parse(row.currentPeriodEnd);
  return !Number.isFinite(t) || t + GRACE_MS >= Date.now();
}

/** La herramienta de limpieza trabaja (pagada o en prueba gratis). Sin ella sólo se configura: vista previa. */
export function hostHasCleaningTool(hostId: string): boolean {
  return paidUp(getHostEntitlement(hostId, HOST_SKU_CLEANING));
}

/** Asientos de colaborador pagados (o en prueba gratis). */
export function collaboratorSeats(hostId: string): number {
  const row = getHostEntitlement(hostId, HOST_SKU_COLLABORATORS);
  return paidUp(row) ? Math.max(0, row?.quantity ?? 1) : 0;
}

/**
 * Las herramientas de equipo están en marcha: colaboradores o limpieza pagada (o en prueba).
 * Con ninguna, los chats de equipo se ven y se arman, pero no se puede escribir en ellos.
 */
export function teamToolsLive(hostId: string): boolean {
  return collaboratorSeats(hostId) > 0 || hostHasCleaningTool(hostId);
}

export function collaboratorSeatsUsed(hostId: string, exceptMemberId?: string): number {
  return listTeamForHost(hostId).filter(
    (m) => m.id !== exceptMemberId && (m.status === "pending" || m.status === "active") && memberNeedsSeat(m.roles)
  ).length;
}

/**
 * Lo que una persona del equipo puede hacer hoy. Si el anfitrión deja de pagar los
 * asientos, el acceso a reservas y mensajes se apaga; si deja de pagar limpieza, la de limpieza.
 */
export function memberEffectiveRoles(m: TeamMember): TeamRole[] {
  const seats = collaboratorSeats(m.hostId);
  const seated =
    seats > 0 &&
    listTeamForHost(m.hostId)
      .filter((x) => memberNeedsSeat(x.roles) && (x.status === "active" || x.status === "pending"))
      .sort((a, b) => a.invitedAt.localeCompare(b.invitedAt))
      .slice(0, seats)
      .some((x) => x.id === m.id);
  const cleaning = hostHasCleaningTool(m.hostId);
  return m.roles.filter((r) => (r === "cleaning" ? cleaning : seated));
}

export function memberCan(userId: string, hostId: string, role: TeamRole, listingId?: string): TeamMember | null {
  const m = activeMembership(userId, hostId);
  if (!m) return null;
  if (!memberEffectiveRoles(m).includes(role)) return null;
  if (listingId && !memberCoversListing(m, listingId)) return null;
  return m;
}

export type BookingActor = { hostId: string; owner: boolean; member?: TeamMember };

/** El dueño del anuncio, o alguien de su equipo con el rol para ese anuncio. */
export function bookingActor(user: UserRecord | null, booking: BookingRecord, role: TeamRole = "bookings"): BookingActor | null {
  if (!user) return null;
  if (booking.hostId === user.id && (user.role === "host" || user.role === "admin")) {
    return { hostId: booking.hostId, owner: true };
  }
  const member = memberCan(user.id, booking.hostId, role, booking.hostAdjustedListingId ?? booking.listingId);
  return member ? { hostId: booking.hostId, owner: false, member } : null;
}

/** Para listados: el anfitrión mismo, o el anfitrión `hostParam` si el usuario es de su equipo. */
export function hostScope(
  user: UserRecord | null,
  hostParam: string | null,
  role: TeamRole
): { hostId: string; owner: boolean; member?: TeamMember } | null {
  if (!user) return null;
  if (!hostParam || hostParam === user.id) {
    return user.role === "host" || user.role === "admin" ? { hostId: user.id, owner: true } : null;
  }
  const m = memberCan(user.id, hostParam, role);
  return m ? { hostId: hostParam, owner: false, member: m } : null;
}
