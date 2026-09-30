import type { NextRequest } from "next/server";
import {
  getPartnerApiSecret,
  partnerNotConfiguredResponse,
  verifyPartnerBearer,
  partnerAuthErrorResponse,
} from "@/lib/beeagent-partner";
import { provisionHostFromBeeagent } from "@/lib/beeagent-host-provision";
import { partnerIdempotentJsonAsync } from "@/lib/beeagent-route-helpers";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!getPartnerApiSecret()) return partnerNotConfiguredResponse(req);
  if (!verifyPartnerBearer(req)) return partnerAuthErrorResponse(req);

  const body = await req.json().catch(() => ({}));
  return partnerIdempotentJsonAsync(req, async () => {
    const result = await provisionHostFromBeeagent(body);
    if (!result.ok) {
      return { status: result.status, body: { error: result.error, code: result.code } };
    }
    const { host_id, display_name, created, linked, listings_count, pending_confirm } = result;
    return {
      status: 200,
      body: {
        host_id,
        display_name,
        created,
        linked,
        listings_count,
        pending_confirm: Boolean(pending_confirm),
      },
    };
  });
}
