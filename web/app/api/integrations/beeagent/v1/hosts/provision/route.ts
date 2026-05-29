import type { NextRequest } from "next/server";
import {
  getPartnerApiSecret,
  partnerJson,
  partnerNotConfiguredResponse,
  verifyPartnerBearer,
  partnerAuthErrorResponse,
} from "@/lib/beeagent-partner";
import { provisionHostFromBeeagent } from "@/lib/beeagent-host-provision";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!getPartnerApiSecret()) return partnerNotConfiguredResponse(req);
  if (!verifyPartnerBearer(req)) return partnerAuthErrorResponse(req);

  const body = await req.json().catch(() => ({}));
  const result = await provisionHostFromBeeagent(body);
  if (!result.ok) {
    return partnerJson({ error: result.error }, req, { status: result.status });
  }
  const { host_id, display_name, created, linked, listings_count } = result;
  return partnerJson({ host_id, display_name, created, linked, listings_count }, req);
}
