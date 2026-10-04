import "server-only";
import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import {
  getBeeagentLinkForCustomer,
  getBeeagentLinkForHost,
  type BeeagentHostLinkRecord,
} from "@/lib/beeagent-host-link-store";
import {
  getPartnerApiSecret,
  parseBeeagentCustomerId,
  partnerAuthErrorResponse,
  partnerJson,
  partnerNotConfiguredResponse,
  verifyPartnerBearer,
} from "@/lib/beeagent-partner";
import type { BotPermission } from "@/lib/beeagent-permission-defs";
import { botCan } from "@/lib/beeagent-permissions";
import { threadPermission } from "@/lib/cleaning-thread";

export type PartnerLinkOk = {
  ok: true;
  customerId: number;
  link: BeeagentHostLinkRecord;
};

export type PartnerLinkDenied = { ok: false; response: NextResponse };

/**
 * Bearer de socio + X-Beeagent-Customer-Id + vínculo activo host ↔ customer.
 * Sin cualquiera de los tres: 403 (salvo secreto ausente / bearer malo).
 * Con `permission`, además el anfitrión tiene que haberle dado ese permiso (o alguno de la lista).
 */
export function requirePartnerLinkedHost(
  req: NextRequest,
  hostId: string,
  permission?: BotPermission | BotPermission[]
): PartnerLinkOk | PartnerLinkDenied {
  if (!getPartnerApiSecret()) {
    return { ok: false, response: partnerNotConfiguredResponse(req) };
  }
  if (!verifyPartnerBearer(req)) {
    return { ok: false, response: partnerAuthErrorResponse(req) };
  }
  const customerId = parseBeeagentCustomerId(req);
  if (!customerId) {
    return {
      ok: false,
      response: partnerJson(
        { error: "Falta X-Beeagent-Customer-Id.", code: "customer_id_required" },
        req,
        { status: 403 }
      ),
    };
  }
  const id = hostId.trim();
  if (!id) {
    return {
      ok: false,
      response: partnerJson({ error: "Falta hostId.", code: "not_linked" }, req, { status: 403 }),
    };
  }
  const byHost = getBeeagentLinkForHost(id);
  const byCustomer = getBeeagentLinkForCustomer(customerId);
  if (!byHost || !byCustomer || byHost.hostId !== id || byHost.beeagentCustomerId !== customerId) {
    return {
      ok: false,
      response: partnerJson(
        { error: "Este workspace no está vinculado a ese anfitrión.", code: "not_linked" },
        req,
        { status: 403 }
      ),
    };
  }
  if (permission) {
    const anyOf = Array.isArray(permission) ? permission : [permission];
    if (!anyOf.some((p) => botCan(id, p))) {
      return {
        ok: false,
        response: partnerJson(
          {
            error: "El anfitrión no le dio permiso a urbnbeeai para esto.",
            code: "permission_denied",
            permission: anyOf[0],
          },
          req,
          { status: 403 }
        ),
      };
    }
  }
  return { ok: true, customerId, link: byHost };
}

/** Los hilos con huéspedes piden «messages»; los hilos con el equipo de limpieza, «cleanings_coordinate». */
export const THREAD_PERMISSIONS: BotPermission[] = ["messages", "cleanings_coordinate"];

export function partnerThreadDenied(req: NextRequest, hostId: string, guestSessionId: string): NextResponse | null {
  const permission = threadPermission(hostId, guestSessionId);
  if (botCan(hostId, permission)) return null;
  return partnerJson(
    { error: "El anfitrión no le dio permiso a urbnbeeai para esto.", code: "permission_denied", permission },
    req,
    { status: 403 }
  );
}

/** Con sólo «Mandar ligas», el agente ve únicamente las reservas que nacieron de sus ligas. */
export function partnerBookingHidden(req: NextRequest, booking: { hostId: string; beeagentRef?: string }): NextResponse | null {
  if (botCan(booking.hostId, "bookings_view") || booking.beeagentRef) return null;
  return partnerJson(
    { error: "El anfitrión no le dio permiso a urbnbeeai para esto.", code: "permission_denied", permission: "bookings_view" },
    req,
    { status: 403 }
  );
}
