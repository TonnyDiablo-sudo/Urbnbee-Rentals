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
      api_version: "v2",
      baseUrl: root,
      corsOrigins: "URBNBEE_PARTNER_ORIGINS (default urbnbeeai.com + www)",
      endpoints: {
        health: { method: "GET", path: `${root}/health`, auth: "none" },
        host: {
          method: "GET",
          path: `${root}/v1/host/:hostId`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
        },
        listingsByHost: {
          method: "GET",
          path: `${root}/v1/listings?hostId=`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
        },
        listing: {
          method: "GET",
          path: `${root}/v1/listings/:listingIdOrSlug`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
        },
        bookingLead: {
          method: "POST",
          path: `${root}/v1/booking-leads`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
        },
        hostProvision: {
          method: "POST",
          path: `${root}/v1/hosts/provision`,
          auth: "Bearer",
          note: "Email nuevo: crea host sin vincular (pending_confirm). Email existente: 409 host_exists_confirm_required.",
        },
        hostLink: {
          method: "POST",
          path: `${root}/v1/hosts/link`,
          auth: "Bearer",
          note: "Código de /host/settings/integrations o del flujo connect",
        },
        hostUnlink: {
          method: "DELETE",
          path: `${root}/v1/hosts/:hostId/link`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
        },
        connect: {
          method: "GET",
          path: `${base}/host/settings/integrations/connect?return_url=&state=`,
          auth: "sesión host en Cabibee",
        },
        availability: {
          method: "GET",
          path: `${root}/v1/listings/:id/availability?from=&to=`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
        },
        quote: {
          method: "POST",
          path: `${root}/v1/listings/:id/quote`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
        },
        bookingLink: {
          method: "POST",
          path: `${root}/v1/listings/:id/booking-link`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
        },
        hostBookings: {
          method: "GET",
          path: `${root}/v1/hosts/:hostId/bookings`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
        },
        booking: {
          method: "GET",
          path: `${root}/v1/bookings/:id`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
        },
        bookingByRef: {
          method: "GET",
          path: `${root}/v1/bookings?ref=`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
        },
        guestRequirements: {
          method: "GET",
          path: `${root}/v1/bookings/:id/guest-requirements`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
        },
        entitlements: {
          method: "POST",
          path: `${root}/v1/hosts/:hostId/entitlements`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
        },
        agentStatus: {
          method: "POST",
          path: `${root}/v1/hosts/:hostId/agent-status`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
        },
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
