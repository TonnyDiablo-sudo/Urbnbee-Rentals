import type { NextRequest } from "next/server";
import {
  getPartnerApiSecret,
  partnerJson,
  partnerNotConfiguredResponse,
  verifyPartnerBearer,
  partnerAuthErrorResponse,
} from "@/lib/beeagent-partner";
import { BOT_PERMISSION_KEYS, DEFAULT_BOT_PERMISSIONS } from "@/lib/beeagent-permission-defs";
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
      permissions: {
        keys: BOT_PERMISSION_KEYS,
        defaults: DEFAULT_BOT_PERMISSIONS,
        where: "GET /v1/host/:hostId → permissions; webhook host.permissions_changed",
        denied: "403 { code: \"permission_denied\", permission }",
      },
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
        hostCleanings: {
          method: "GET|POST",
          path: `${root}/v1/hosts/:hostId/cleanings?from=&to=&listingId=&status=`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
          permission: "GET cleanings_view · POST cleanings_manage",
        },
        hostCleaning: {
          method: "PATCH",
          path: `${root}/v1/hosts/:hostId/cleanings/:cleaningId`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
          permission: "cleanings_manage",
          note: "{status?, note?, assignee_id?, date?, time?}",
        },
        hostCleaningListing: {
          method: "PATCH",
          path: `${root}/v1/hosts/:hostId/cleanings/listings/:listingId`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
          permission: "cleanings_manage",
          note: "{default_cleaner_id}",
        },
        hostCleaningMessage: {
          method: "POST",
          path: `${root}/v1/hosts/:hostId/cleanings/:cleaningId/message`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
          permission: "cleanings_coordinate",
          note: "Escribe a quien tiene asignada la limpieza. Sus respuestas llegan como message.created con counterpart: cleaning_team.",
        },
        bookingAccept: {
          method: "POST",
          path: `${root}/v1/hosts/:hostId/bookings/:bookingId/accept`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
          permission: "bookings_decide (+ contracts_sign o contrato firmado por adelantado)",
        },
        bookingReject: {
          method: "POST",
          path: `${root}/v1/hosts/:hostId/bookings/:bookingId/reject`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
          permission: "bookings_decide",
        },
        bookingSign: {
          method: "POST",
          path: `${root}/v1/hosts/:hostId/bookings/:bookingId/sign`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
          permission: "contracts_sign",
        },
        chatChannel: {
          method: "GET|PUT",
          path: `${root}/v1/hosts/:hostId/chat-channel`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
          note: "PUT {enabled:true} cuando la central de chat de urbnbeeai ya recibe el chat de Cabibee.",
        },
        conversations: {
          method: "GET",
          path: `${root}/v1/hosts/:hostId/conversations`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
        },
        conversation: {
          method: "GET",
          path: `${root}/v1/hosts/:hostId/conversations/:listingId/:guestSessionId`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
        },
        conversationReply: {
          method: "POST",
          path: `${root}/v1/hosts/:hostId/conversations/:listingId/:guestSessionId/messages`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
          note: "Sólo con la IA encendida en esa conversación (409 ai_disabled).",
        },
        conversationAi: {
          method: "GET|POST",
          path: `${root}/v1/hosts/:hostId/conversations/:listingId/:guestSessionId/ai`,
          auth: "Bearer + X-Beeagent-Customer-Id + vínculo",
          note: "POST {ai_replies_enabled, if_match_updated_at?}",
        },
        conversationAttachment: {
          method: "GET",
          path: `${root}/v1/hosts/:hostId/conversations/:listingId/:guestSessionId/attachments/:file`,
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
