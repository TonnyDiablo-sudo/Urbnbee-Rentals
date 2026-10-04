import type { NextRequest } from "next/server";
import { bookingPartnerListItem } from "@/lib/beeagent-booking-public";
import { isIsoDate } from "@/lib/beeagent-iso-date";
import { partnerJson } from "@/lib/beeagent-partner";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { applyBookingLifecycle } from "@/lib/booking-deposit";
import { canonicalBookingStatus } from "@/lib/booking-machine";
import { listBookingsForHost } from "@/lib/bookings-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { hostId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId, "bookings_view");
  if (!gate.ok) return gate.response;

  const status = req.nextUrl.searchParams.get("status")?.trim();
  const from = req.nextUrl.searchParams.get("from")?.trim() ?? "";
  const to = req.nextUrl.searchParams.get("to")?.trim() ?? "";

  let rows = listBookingsForHost(hostId).map(applyBookingLifecycle);
  if (status) {
    rows = rows.filter((b) => canonicalBookingStatus(b.status) === status);
  }
  if (isIsoDate(from)) {
    rows = rows.filter((b) => (b.hostAdjustedCheckIn ?? b.checkIn) >= from);
  }
  if (isIsoDate(to)) {
    rows = rows.filter((b) => (b.hostAdjustedCheckIn ?? b.checkIn) <= to);
  }

  return partnerJson(
    { host_id: hostId, count: rows.length, bookings: rows.map(bookingPartnerListItem) },
    req
  );
}
