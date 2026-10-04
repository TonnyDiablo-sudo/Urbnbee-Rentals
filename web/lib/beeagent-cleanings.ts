import "server-only";
import { hostCleaningView } from "@/lib/cleaning-service";
import type { CleaningTask } from "@/lib/cleaning-store";
import { getTeamMember } from "@/lib/team-store";

export function cleaningPartnerView(t: CleaningTask) {
  const member = t.assignee && t.assignee !== "host" ? getTeamMember(t.assignee) : undefined;
  return {
    id: t.id,
    listing_id: t.listingId,
    booking_id: t.bookingId ?? null,
    date: t.date,
    time: t.time ?? null,
    date_moved: Boolean(t.dateLocked),
    next_check_in: t.nextCheckIn ?? null,
    status: t.status,
    assigned_to: !t.assignee ? null : t.assignee === "host" ? "host" : "team_member",
    assignee_id: t.assignee ?? null,
    /** Hilo del chat con quien limpia (sólo con «Coordinar limpiezas»). */
    cleaner_guest_session_id: member?.status === "active" && member.userId ? `gu_${member.userId}` : null,
    guest_name: t.guestName ?? null,
    note: t.note ?? null,
    done_at: t.doneAt ?? null,
    photos: t.photos?.length ?? 0,
  };
}

/** Quién puede limpiar ("host" = el anfitrión) y quién limpia cada anuncio por omisión. */
export function cleaningTeamPartnerView(hostId: string) {
  const v = hostCleaningView(hostId);
  return {
    cleaners: v.cleaners.map((c) => ({ id: c.id, name: c.name, listing_ids: c.listingIds })),
    listings: v.listings.map((l) => ({ id: l.id, title: l.title, in_cleaning_tool: l.on, default_cleaner_id: l.cleaner })),
    settings: { assign_mode: v.settings.assignMode, require_photo: v.settings.requirePhoto },
  };
}
