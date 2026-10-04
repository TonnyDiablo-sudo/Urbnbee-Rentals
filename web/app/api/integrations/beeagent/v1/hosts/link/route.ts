import type { NextRequest } from "next/server";
import {
  getPartnerApiSecret,
  partnerNotConfiguredResponse,
  verifyPartnerBearer,
  partnerAuthErrorResponse,
} from "@/lib/beeagent-partner";
import { linkHostByBeeagentCode } from "@/lib/beeagent-host-provision";
import { partnerIdempotentJsonAsync } from "@/lib/beeagent-route-helpers";
import { getBotPermissions } from "@/lib/beeagent-permissions";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!getPartnerApiSecret()) return partnerNotConfiguredResponse(req);
  if (!verifyPartnerBearer(req)) return partnerAuthErrorResponse(req);

  const body = await req.json().catch(() => ({}));
  return partnerIdempotentJsonAsync(req, async () => {
    const result = await linkHostByBeeagentCode(body);
    if (!result.ok) {
      return { status: result.status, body: { error: result.error } };
    }
    const { host_id, display_name, listings_count } = result;
    return { status: 200, body: { host_id, display_name, listings_count, permissions: getBotPermissions(host_id) } };
  });
}
