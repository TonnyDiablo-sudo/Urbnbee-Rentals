import { NextRequest, NextResponse } from "next/server";
import { applyBookingLifecycle } from "@/lib/booking-deposit";
import { getBookingById } from "@/lib/bookings-store";
import { getLang } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { createStayReview } from "@/lib/stay-reviews";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const found = getBookingById(id);
  if (!found || found.guestUserId !== user.id) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }
  const booking = applyBookingLifecycle(found);
  const body = await req.json().catch(() => ({}));
  const result = await createStayReview({
    booking,
    authorUserId: user.id,
    kind: "guest_to_listing",
    rating: Number(body.rating),
    comment: String(body.comment ?? ""),
    lang: await getLang(),
  });
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 409 });
  }
  return NextResponse.json({ ok: true, review: result.review, pending: result.pending ?? false, message: result.message });
}
