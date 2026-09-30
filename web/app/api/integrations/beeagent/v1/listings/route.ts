import type { NextRequest } from "next/server";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { partnerJson } from "@/lib/beeagent-partner";
import { listingPartnerView } from "@/lib/beeagent-listing-public";
import { listListingsForHost } from "@/lib/marketplace-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const hostId = req.nextUrl.searchParams.get("hostId")?.trim() ?? "";
  const gate = requirePartnerLinkedHost(req, hostId);
  if (!gate.ok) return gate.response;

  const listings = listListingsForHost(hostId).map(listingPartnerView);
  return partnerJson({ hostId, count: listings.length, listings }, req);
}
