import "server-only";
import { hostCleaningView } from "@/lib/cleaning-service";
import type { CleaningTask } from "@/lib/cleaning-store";

export function cleaningPartnerView(t: CleaningTask) {
  return {
    id: t.id,
    listing_id: t.listingId,
    booking_id: t.bookingId ?? null,
    date: t.date,
    next_check_in: t.nextCheckIn ?? null,
    status: t.status,
    assigned_to: !t.assignee ? null : t.assignee === "host" ? "host" : "team_member",
    assignee_id: t.assignee ?? null,
    guest_name: t.guestName ?? null,
    note: t.note ?? null,
    done_at: t.doneAt ?? null,
    photos: t.photos?.length ?? 0,
  };
}

/** Quién puede limpiar: "host" o el id de una persona del equipo con el rol de limpieza. */
export function cleanersPartnerView(hostId: string) {
  return hostCleaningView(hostId).cleaners.map((c) => ({ id: c.id, name: c.name, listing_ids: c.listingIds }));
}
