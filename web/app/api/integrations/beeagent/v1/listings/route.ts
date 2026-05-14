import type { NextRequest } from "next/server";
import { listListingsForHost } from "@/lib/marketplace-store";
import {
  getPartnerApiSecret,
  partnerJson,
  partnerNotConfiguredResponse,
  verifyPartnerBearer,
  partnerAuthErrorResponse,
} from "@/lib/beeagent-partner";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!getPartnerApiSecret()) return partnerNotConfiguredResponse(req);
  if (!verifyPartnerBearer(req)) return partnerAuthErrorResponse(req);

  const hostId = req.nextUrl.searchParams.get("hostId")?.trim();
  if (!hostId) {
    return partnerJson({ error: "Falta query hostId." }, req, { status: 400 });
  }
  const listings = listListingsForHost(hostId);
  return partnerJson({ hostId, count: listings.length, listings }, req);
}
