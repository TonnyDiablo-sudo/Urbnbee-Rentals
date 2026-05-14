import type { NextRequest } from "next/server";
import {
  getPartnerApiSecret,
  partnerJson,
  partnerNotConfiguredResponse,
  verifyPartnerBearer,
  partnerAuthErrorResponse,
} from "@/lib/beeagent-partner";
import { publicOriginFromRequest } from "@/lib/public-origin";

export const runtime = "nodejs";

/** Contrato mínimo para que BeeAgent (urbnbeeai.com) se cablee sin adivinar rutas. */
export async function GET(req: NextRequest) {
  if (!getPartnerApiSecret()) return partnerNotConfiguredResponse(req);
  if (!verifyPartnerBearer(req)) return partnerAuthErrorResponse(req);

  const base = publicOriginFromRequest(req);
  const root = `${base}/api/integrations/beeagent`;

  return partnerJson(
    {
      partner: "urbnbee-marketplace",
      baseUrl: root,
      corsOrigins: "URBNBEE_PARTNER_ORIGINS (default urbnbeeai.com + www)",
      endpoints: {
        health: { method: "GET", path: `${root}/health`, auth: "none" },
        host: { method: "GET", path: `${root}/v1/host/:hostId`, auth: "Bearer URBNBEE_PARTNER_API_SECRET" },
        listingsByHost: { method: "GET", path: `${root}/v1/listings?hostId=`, auth: "Bearer" },
        listing: { method: "GET", path: `${root}/v1/listings/:listingIdOrSlug`, auth: "Bearer" },
        bookingLead: { method: "POST", path: `${root}/v1/booking-leads`, auth: "Bearer" },
        webhookEvents: {
          method: "POST",
          path: `${root}/v1/webhooks/events`,
          auth: "X-Urbnbee-Signature: sha256=<hmac_sha256(secret, rawBody)>",
        },
      },
    },
    req
  );
}
