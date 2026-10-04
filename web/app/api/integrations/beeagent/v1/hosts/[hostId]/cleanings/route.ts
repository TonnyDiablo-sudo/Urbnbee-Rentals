import type { NextRequest } from "next/server";
import { isIsoDate } from "@/lib/beeagent-iso-date";
import { partnerJson } from "@/lib/beeagent-partner";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { listCleaningTasksForHost } from "@/lib/cleaning-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string }> };

/** Limpiezas del anfitrión: ?from=&to= (YYYY-MM-DD), ?listingId=, ?status=pending|done|cancelled. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { hostId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId);
  if (!gate.ok) return gate.response;

  const q = req.nextUrl.searchParams;
  const from = q.get("from")?.trim() ?? "";
  const to = q.get("to")?.trim() ?? "";
  const listingId = q.get("listingId")?.trim() ?? "";
  const status = q.get("status")?.trim() ?? "";

  const rows = listCleaningTasksForHost(hostId)
    .filter((t) => !isIsoDate(from) || t.date >= from)
    .filter((t) => !isIsoDate(to) || t.date <= to)
    .filter((t) => !listingId || t.listingId === listingId)
    .filter((t) => !status || t.status === status)
    .sort((a, b) => a.date.localeCompare(b.date));

  return partnerJson(
    {
      host_id: hostId,
      count: rows.length,
      cleanings: rows.map((t) => ({
        id: t.id,
        listing_id: t.listingId,
        booking_id: t.bookingId ?? null,
        date: t.date,
        next_check_in: t.nextCheckIn ?? null,
        status: t.status,
        assigned_to: !t.assignee ? null : t.assignee === "host" ? "host" : "team_member",
        guest_name: t.guestName ?? null,
        note: t.note ?? null,
        done_at: t.doneAt ?? null,
        photos: t.photos?.length ?? 0,
      })),
    },
    req
  );
}
