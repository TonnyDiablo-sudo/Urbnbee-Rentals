import "server-only";
import type { BotPermission } from "@/lib/beeagent-permission-defs";
import { memberEffectiveRoles } from "@/lib/team-access";
import { listTeamForHost, type TeamMember } from "@/lib/team-store";

/** El hilo del chat es con alguien del equipo de limpieza del anfitrión (no con un huésped). */
export function cleaningMemberForThread(hostId: string, guestSessionId: string): TeamMember | null {
  const m = /^gu_(.+)$/.exec(guestSessionId);
  if (!m) return null;
  return (
    listTeamForHost(hostId).find(
      (t) => t.status === "active" && t.userId === m[1] && memberEffectiveRoles(t).includes("cleaning")
    ) ?? null
  );
}

/** Qué permiso necesita el agente para ese hilo. */
export function threadPermission(hostId: string, guestSessionId: string): BotPermission {
  return cleaningMemberForThread(hostId, guestSessionId) ? "cleanings_coordinate" : "messages";
}
