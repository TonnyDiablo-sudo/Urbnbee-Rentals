import type { NextRequest } from "next/server";
import { createBeeagentBookingLink } from "@/lib/beeagent-booking-links";
import { isIsoDate } from "@/lib/beeagent-iso-date";
import { partnerJson } from "@/lib/beeagent-partner";
import { quoteListingStay } from "@/lib/beeagent-quote";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { resolvePartnerListing } from "@/lib/beeagent-resolve-listing";
import { partnerIdempotentJson } from "@/lib/beeagent-route-helpers";
import { publicOriginFromRequest } from "@/lib/public-origin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ listingId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { listingId } = await ctx.params;
  const listing = resolvePartnerListing(listingId);
  if (!listing) return partnerJson({ error: "Anuncio no encontrado." }, req, { status: 404 });
  const gate = requirePartnerLinkedHost(req, listing.hostId, "booking_links");
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const checkIn = typeof body.check_in === "string" ? body.check_in.trim() : "";
  const checkOut = typeof body.check_out === "string" ? body.check_out.trim() : "";
  const guests = Number(body.guests ?? 1);
  const conversationKey =
    typeof body.conversation_key === "string" ? body.conversation_key.trim().slice(0, 200) : "";

  return partnerIdempotentJson(req, () => {
    if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) {
      return { status: 400, body: { error: "check_in y check_out en YYYY-MM-DD." } };
    }
    const quote = quoteListingStay(listing, checkIn, checkOut, Number.isFinite(guests) ? guests : 1);
    if (!quote.ok) {
      return { status: 409, body: { error: "No se puede armar la liga.", errors: quote.errors } };
    }
    const link = createBeeagentBookingLink({
      listingId: listing.id,
      hostId: listing.hostId,
      checkIn,
      checkOut,
      guests: Number.isFinite(guests) ? Math.round(guests) : 1,
      conversationKey: conversationKey || undefined,
    });
    const origin = publicOriginFromRequest(req);
    const bookingUrl = `${origin}/listings/${listing.slug}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${link.guests}&ref=${encodeURIComponent(link.ref)}`;
    return {
      status: 200,
      body: {
        booking_url: bookingUrl,
        register_url: `${origin}/register?next=${encodeURIComponent(bookingUrl)}`,
        ref: link.ref,
        expires_at: link.expiresAt,
      },
    };
  });
}
