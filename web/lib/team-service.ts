import "server-only";
import { publicNameOf } from "@/lib/display-name";
import { findUserByEmail, findUserById, getListingById, listListingsForHost } from "@/lib/marketplace-store";
import { getHostEntitlement } from "@/lib/host-entitlements-store";
import { HOST_SKU_COLLABORATORS, hostEntitlementInTrial } from "@/lib/host-entitlement-types";
import { notifyUser } from "@/lib/push";
import { hostTrialDays } from "@/lib/store-trial";
import { collaboratorSeats, collaboratorSeatsUsed, hostHasCleaningTool, memberEffectiveRoles, teamToolsLive } from "@/lib/team-access";
import { TRIAL_MAX_COLLABORATORS } from "@/lib/tool-trial";
import {
  addTeamMember,
  getTeamMember,
  listMembershipsForUser,
  listTeamForHost,
  memberNeedsSeat,
  TEAM_ROLE_LABEL,
  TEAM_ROLES,
  updateTeamMember,
  type TeamMember,
  type TeamRole,
} from "@/lib/team-store";

type Result<T> = { ok: true; value: T } | { ok: false; error: string; status: number };

/** Firmar contratos sólo tiene sentido con reservas: se incluye solo. */
export function parseRoles(raw: unknown): TeamRole[] {
  if (!Array.isArray(raw)) return [];
  const picked = new Set(TEAM_ROLES.filter((r) => raw.includes(r)));
  if (picked.has("contracts")) picked.add("bookings");
  return TEAM_ROLES.filter((r) => picked.has(r));
}

export function parseListingScope(hostId: string, raw: unknown): string[] | "all" {
  if (raw === "all") return "all";
  if (!Array.isArray(raw)) return [];
  const mine = new Set(listListingsForHost(hostId).map((l) => l.id));
  return [...new Set(raw.filter((x): x is string => typeof x === "string" && mine.has(x)))];
}

function nameOf(userId: string): string {
  const u = findUserById(userId);
  return (u && publicNameOf(u)) || u?.fullName || u?.email || "Alguien";
}

/**
 * Cuántos colaboradores con asiento caben hoy. Sin pagar (vista previa) se pueden agregar hasta
 * TRIAL_MAX_COLLABORATORS para armar el equipo y explorar; sólo trabajan cuando la herramienta está en marcha.
 */
function seatCapacity(hostId: string): { seats: number; preview: boolean } {
  const seats = collaboratorSeats(hostId);
  return seats > 0 ? { seats, preview: false } : { seats: TRIAL_MAX_COLLABORATORS, preview: true };
}

function checkCapacity(hostId: string, roles: TeamRole[], memberId?: string): string | null {
  if (roles.length === 0) return "Elige al menos un rol.";
  if (memberNeedsSeat(roles)) {
    const { seats, preview } = seatCapacity(hostId);
    if (collaboratorSeatsUsed(hostId, memberId) >= seats) {
      return preview
        ? `En la vista previa puedes agregar hasta ${seats} colaboradores. Para más, activa la herramienta de colaboradores en la Tienda.`
        : `Ya usas tus ${seats} asientos de colaborador. Agrega otro en la Tienda o quita a alguien.`;
    }
  }
  // El rol de limpieza se asigna aunque la herramienta esté en vista previa: trabaja cuando se active.
  return null;
}

export function inviteTeamMember(
  hostId: string,
  input: { email: unknown; roles: unknown; listingIds: unknown }
): Result<TeamMember> {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Escribe un correo válido.", status: 400 };
  const host = findUserById(hostId);
  if (host?.email.toLowerCase() === email) return { ok: false, error: "No puedes invitarte a ti mismo.", status: 400 };
  const invitee = findUserByEmail(email);
  if (!invitee) {
    return {
      ok: false,
      error: "Esa persona todavía no tiene cuenta en Cabibee. Pídele que se registre gratis con ese correo y vuelve a invitarla.",
      status: 404,
    };
  }
  if (listTeamForHost(hostId).some((m) => m.email === email)) {
    return { ok: false, error: "Esa persona ya está en tu equipo o tiene una invitación pendiente.", status: 409 };
  }
  const roles = parseRoles(input.roles);
  const listingIds = parseListingScope(hostId, input.listingIds);
  if (listingIds !== "all" && listingIds.length === 0) {
    return { ok: false, error: "Elige al menos un anuncio.", status: 400 };
  }
  const problem = checkCapacity(hostId, roles);
  if (problem) return { ok: false, error: problem, status: 409 };

  const member = addTeamMember({ hostId, email, roles, listingIds });
  notifyUser(invitee.id, {
    rawBody: true,
    kind: "team",
    title: "Te invitaron a un equipo",
    body: `${nameOf(hostId)} te invitó a colaborar: ${roles.map((r) => TEAM_ROLE_LABEL[r]).join(", ")}.`,
    url: "/equipo",
  });
  return { ok: true, value: member };
}

export function updateTeamMemberAccess(
  hostId: string,
  memberId: string,
  input: { roles?: unknown; listingIds?: unknown }
): Result<TeamMember> {
  const m = getTeamMember(memberId);
  if (!m || m.hostId !== hostId || m.status === "revoked" || m.status === "declined") {
    return { ok: false, error: "No encontrado.", status: 404 };
  }
  const roles = input.roles !== undefined ? parseRoles(input.roles) : m.roles;
  const listingIds = input.listingIds !== undefined ? parseListingScope(hostId, input.listingIds) : m.listingIds;
  if (listingIds !== "all" && listingIds.length === 0) return { ok: false, error: "Elige al menos un anuncio.", status: 400 };
  const gainsSeat = memberNeedsSeat(roles) && !memberNeedsSeat(m.roles);
  const problem = gainsSeat || roles.includes("cleaning") ? checkCapacity(hostId, roles, memberId) : roles.length ? null : "Elige al menos un rol.";
  if (problem) return { ok: false, error: problem, status: 409 };
  const next = updateTeamMember(memberId, { roles, listingIds });
  if (!next) return { ok: false, error: "No se pudo guardar.", status: 500 };
  if (next.userId) {
    notifyUser(next.userId, {
    rawBody: true,
      kind: "team",
      title: "Cambió tu acceso",
      body: `${nameOf(hostId)} actualizó tus roles: ${roles.map((r) => TEAM_ROLE_LABEL[r]).join(", ")}.`,
      url: "/equipo",
    });
  }
  return { ok: true, value: next };
}

export function revokeTeamMember(hostId: string, memberId: string): Result<TeamMember> {
  const m = getTeamMember(memberId);
  if (!m || m.hostId !== hostId) return { ok: false, error: "No encontrado.", status: 404 };
  const next = updateTeamMember(memberId, { status: "revoked" });
  if (!next) return { ok: false, error: "No se pudo guardar.", status: 500 };
  if (m.userId && m.status === "active") {
    notifyUser(m.userId, {
    rawBody: true,
      kind: "team",
      title: "Ya no tienes acceso",
      body: `${nameOf(hostId)} te quitó del equipo.`,
      url: "/equipo",
    });
  }
  return { ok: true, value: next };
}

export function respondToInvite(
  user: { id: string; email: string },
  memberId: string,
  accept: boolean
): Result<TeamMember> {
  const m = getTeamMember(memberId);
  if (!m || m.status !== "pending" || m.email !== user.email.trim().toLowerCase()) {
    return { ok: false, error: "Invitación no encontrada.", status: 404 };
  }
  const next = updateTeamMember(memberId, {
    status: accept ? "active" : "declined",
    userId: user.id,
    respondedAt: new Date().toISOString(),
  });
  if (!next) return { ok: false, error: "No se pudo guardar.", status: 500 };
  notifyUser(m.hostId, {
    rawBody: true,
    kind: "team",
    title: accept ? "Aceptaron tu invitación" : "Rechazaron tu invitación",
    body: `${nameOf(user.id)} ${accept ? "ya forma parte de tu equipo" : "no aceptó la invitación"}.`,
    url: "/host/colaboradores",
  });
  return { ok: true, value: next };
}

function listingTitles(m: TeamMember): string[] {
  if (m.listingIds === "all") return ["Todos los anuncios"];
  return m.listingIds.map((id) => getListingById(id)?.title || "Anuncio");
}

/** Panel del anfitrión. */
export function hostTeamView(hostId: string) {
  const members = listTeamForHost(hostId).map((m) => ({
    id: m.id,
    email: m.email,
    name: m.userId ? nameOf(m.userId) : findUserByEmail(m.email)?.fullName || m.email,
    roles: m.roles,
    effectiveRoles: m.status === "active" ? memberEffectiveRoles(m) : m.roles,
    listingIds: m.listingIds,
    listingTitles: listingTitles(m),
    status: m.status,
    invitedAt: m.invitedAt,
  }));
  const { seats, preview } = seatCapacity(hostId);
  const seatRow = getHostEntitlement(hostId, HOST_SKU_COLLABORATORS);
  return {
    members,
    seats: { paid: preview ? 0 : seats, used: collaboratorSeatsUsed(hostId), previewMax: TRIAL_MAX_COLLABORATORS },
    /** Sin herramienta pagada ni en prueba: se configura todo, pero el equipo no tiene acceso todavía. */
    preview,
    /** Prueba gratis en curso (hasta esta fecha). */
    trialEndsAt: hostEntitlementInTrial(seatRow) ? seatRow?.trialEndsAt : undefined,
    /** Ya usó su prueba gratis: en la Tienda sólo queda activarla. */
    trialUsed: Boolean(seatRow?.trialUsedAt),
    /** Días de prueba gratis que se le ofrecen (si el admin la tiene encendida y nunca la usó). */
    trialDays: hostTrialDays(hostId, "collaborator_seat"),
    cleaningTool: hostHasCleaningTool(hostId),
    teamChatLive: teamToolsLive(hostId),
    listings: listListingsForHost(hostId).map((l) => ({ id: l.id, title: l.title || "Sin título" })),
  };
}

/** Lo que ve quien colabora: invitaciones y equipos. */
export function myTeamsView(user: { id: string; email: string }) {
  return listMembershipsForUser(user.id, user.email).map((m) => ({
    id: m.id,
    hostId: m.hostId,
    hostName: nameOf(m.hostId),
    status: m.status,
    roles: m.status === "active" ? memberEffectiveRoles(m) : m.roles,
    listingTitles: listingTitles(m),
  }));
}
