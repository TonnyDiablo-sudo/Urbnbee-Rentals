import type { NextRequest } from "next/server";
import { isIsoDate } from "@/lib/beeagent-iso-date";
import { partnerJson } from "@/lib/beeagent-partner";
import { quoteListingStay } from "@/lib/beeagent-quote";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { resolvePartnerListing } from "@/lib/beeagent-resolve-listing";
import { partnerIdempotentJson } from "@/lib/beeagent-route-helpers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ listingId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { listingId } = await ctx.params;
  const listing = resolvePartnerListing(listingId);
  if (!listing) return partnerJson({ error: "Anuncio no encontrado." }, req, { status: 404 });
  const gate = requirePartnerLinkedHost(req, listing.hostId);
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const checkIn = typeof body.check_in === "string" ? body.check_in.trim() : "";
  const checkOut = typeof body.check_out === "string" ? body.check_out.trim() : "";
  const guests = Number(body.guests ?? 1);

  return partnerIdempotentJson(req, () => {
    if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) {
      return { status: 400, body: { error: "check_in y check_out en YYYY-MM-DD." } };
    }
    if (!Number.isFinite(guests) || guests < 1) {
      return { status: 400, body: { error: "guests debe ser >= 1." } };
    }
    return { status: 200, body: quoteListingStay(listing, checkIn, checkOut, Math.round(guests)) };
  });
}
