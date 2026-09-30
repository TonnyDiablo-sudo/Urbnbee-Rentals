import type { NextRequest } from "next/server";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { partnerJson } from "@/lib/beeagent-partner";
import { listingPartnerView } from "@/lib/beeagent-listing-public";
import { resolvePartnerListing } from "@/lib/beeagent-resolve-listing";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ listingId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { listingId: raw } = await ctx.params;
  const listing = resolvePartnerListing(raw);
  if (!listing) {
    return partnerJson({ error: "Anuncio no encontrado." }, req, { status: 404 });
  }

  const hostId = req.nextUrl.searchParams.get("hostId")?.trim() || listing.hostId;
  if (listing.hostId !== hostId) {
    return partnerJson({ error: "Anuncio no encontrado." }, req, { status: 404 });
  }

  const gate = requirePartnerLinkedHost(req, listing.hostId);
  if (!gate.ok) return gate.response;

  return partnerJson({ listing: listingPartnerView(listing) }, req);
}
