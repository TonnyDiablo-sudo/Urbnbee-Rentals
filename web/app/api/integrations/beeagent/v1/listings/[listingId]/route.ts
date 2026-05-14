import type { NextRequest } from "next/server";
import { getListingById, getListingBySlug } from "@/lib/marketplace-store";
import {
  getPartnerApiSecret,
  partnerJson,
  partnerNotConfiguredResponse,
  verifyPartnerBearer,
  partnerAuthErrorResponse,
} from "@/lib/beeagent-partner";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ listingId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!getPartnerApiSecret()) return partnerNotConfiguredResponse(req);
  if (!verifyPartnerBearer(req)) return partnerAuthErrorResponse(req);

  const { listingId: raw } = await ctx.params;
  const key = decodeURIComponent(raw);
  const listing = getListingById(key) ?? getListingBySlug(key);
  if (!listing) {
    return partnerJson({ error: "Anuncio no encontrado." }, req, { status: 404 });
  }
  return partnerJson({ listing }, req);
}
