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

export type PartnerLinkOk = {
  ok: true;
  customerId: number;
  link: BeeagentHostLinkRecord;
};

export type PartnerLinkDenied = { ok: false; response: NextResponse };

/**
 * Bearer de socio + X-Beeagent-Customer-Id + vínculo activo host ↔ customer.
 * Sin cualquiera de los tres: 403 (salvo secreto ausente / bearer malo).
 */
export function requirePartnerLinkedHost(
  req: NextRequest,
  hostId: string
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
  return { ok: true, customerId, link: byHost };
}
