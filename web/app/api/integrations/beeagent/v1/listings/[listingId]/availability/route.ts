import type { NextRequest } from "next/server";
import { availabilityPayload } from "@/lib/beeagent-availability";
import { addDaysIso, eachIsoNight, isIsoDate } from "@/lib/beeagent-iso-date";
import { partnerJson } from "@/lib/beeagent-partner";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { resolvePartnerListing } from "@/lib/beeagent-resolve-listing";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ listingId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { listingId } = await ctx.params;
  const listing = resolvePartnerListing(listingId);
  if (!listing) return partnerJson({ error: "Anuncio no encontrado." }, req, { status: 404 });
  const gate = requirePartnerLinkedHost(req, listing.hostId);
  if (!gate.ok) return gate.response;

  const from = req.nextUrl.searchParams.get("from")?.trim() ?? "";
  const to = req.nextUrl.searchParams.get("to")?.trim() ?? "";
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
    return partnerJson({ error: "Usa from y to en YYYY-MM-DD." }, req, { status: 400 });
  }
  if (eachIsoNight(from, addDaysIso(to, 1)).length > 180) {
    return partnerJson({ error: "El rango no puede pasar de 180 días." }, req, { status: 400 });
  }

  return partnerJson(availabilityPayload(listing, from, to), req);
}
