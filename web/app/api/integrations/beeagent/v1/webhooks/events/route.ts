import type { NextRequest } from "next/server";
import {
  getPartnerWebhookSecret,
  partnerJson,
  verifyPartnerWebhookSignature,
} from "@/lib/beeagent-partner";

export const runtime = "nodejs";

/**
 * Eventos entrantes desde BeeAgent (escalaciones, metadata de conversación, etc.).
 * Firma: header `X-Urbnbee-Signature: sha256=<hex>` = HMAC-SHA256(URBNBEE_PARTNER_WEBHOOK_SECRET, rawBody).
 * Si no defines `URBNBEE_PARTNER_WEBHOOK_SECRET`, se usa `URBNBEE_PARTNER_API_SECRET`.
 */
export async function POST(req: NextRequest) {
  if (!getPartnerWebhookSecret()) {
    return partnerJson(
      { error: "URBNBEE_PARTNER_WEBHOOK_SECRET o URBNBEE_PARTNER_API_SECRET no configurada." },
      req,
      { status: 503 }
    );
  }

  const raw = await req.text();
  const sig = req.headers.get("x-urbnbee-signature");
  if (!verifyPartnerWebhookSignature(raw, sig)) {
    return partnerJson({ error: "Firma inválida." }, req, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = raw.length ? JSON.parse(raw) : {};
  } catch {
    return partnerJson({ error: "JSON inválido." }, req, { status: 400 });
  }

  console.info("[beeagent-webhook]", JSON.stringify({ receivedAt: new Date().toISOString(), payload }));

  return partnerJson({ ok: true, accepted: true }, req);
}
