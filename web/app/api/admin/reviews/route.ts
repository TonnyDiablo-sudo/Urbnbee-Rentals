import { NextRequest, NextResponse } from "next/server";
import { getBookingById } from "@/lib/bookings-store";
import { findUserById, getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { decidePendingReview } from "@/lib/stay-reviews";
import { listStayReviews } from "@/lib/stay-reviews-store";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getSessionUser();
  return user?.role === "admin" ? user : null;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = listStayReviews()
    .filter((r) => r.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((r) => {
      const booking = getBookingById(r.bookingId);
      const author = findUserById(r.authorUserId);
      const listing = booking ? getListingById(booking.listingId) : undefined;
      return {
        id: r.id,
        kind: r.kind,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        attempts: r.reviewAttempts ?? 1,
        authorName: author?.fullName || author?.email || r.authorUserId,
        authorEmail: author?.email,
        listingTitle: listing?.title,
        guestName: booking?.guestName,
      };
    });
  return NextResponse.json({ reviews: rows });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { id?: string; decision?: string; reason?: string };
  if (!body.id || (body.decision !== "published" && body.decision !== "rejected")) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  const reason = String(body.reason ?? "").trim().slice(0, 300) || undefined;
  const next = decidePendingReview(body.id, body.decision, { by: "team", reason });
  if (!next) return NextResponse.json({ error: "Esa reseña ya no está en revisión." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
