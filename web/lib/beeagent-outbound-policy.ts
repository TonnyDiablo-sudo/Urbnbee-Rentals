import { createHmac } from "node:crypto";

export const OUTBOUND_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const OUTBOUND_MAX_BODY = 64 * 1024;

export type OutboundEventName =
  | "booking.requested"
  | "booking.contract_signed"
  | "booking.paid"
  | "booking.confirmed"
  | "booking.rejected"
  | "booking.cancelled"
  | "booking.refunded"
  | "booking.expired"
  | "host.entitlements_changed"
  | "host.unlinked";

export type OutboundDelivery = "delivered" | "drop" | "retry";

const BACKOFF_MS = [
  60_000, 120_000, 300_000, 900_000, 1_800_000, 3_600_000, 7_200_000, 14_400_000, 28_800_000,
];

export function signCabibeeWebhookBody(secret: string, rawBody: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

export function nextOutboundAttemptAt(attemptsAfterThis: number, createdAtMs: number, now = Date.now()): string | null {
  if (now - createdAtMs >= OUTBOUND_MAX_AGE_MS) return null;
  const delay = BACKOFF_MS[Math.min(attemptsAfterThis - 1, BACKOFF_MS.length - 1)] ?? 60_000;
  const at = now + delay;
  if (at - createdAtMs > OUTBOUND_MAX_AGE_MS) {
    return new Date(createdAtMs + OUTBOUND_MAX_AGE_MS).toISOString();
  }
  return new Date(at).toISOString();
}

export function classifyOutboundResponse(httpStatus: number): OutboundDelivery {
  if (httpStatus === 400 || httpStatus === 401) return "drop";
  if (httpStatus === 200 || (httpStatus > 200 && httpStatus < 300)) return "delivered";
  if (httpStatus === 503 || httpStatus >= 500) return "retry";
  return "retry";
}

export function partnerWebhookUrl(): string {
  return (
    process.env.URBNBEEAI_WEBHOOK_URL?.trim() ||
    "https://www.urbnbeeai.com/api/integrations/cabibee/webhooks"
  );
}
