import "server-only";
import { randomBytes } from "node:crypto";
import { getBeeagentLinkForHost } from "@/lib/beeagent-host-link-store";
import {
  classifyOutboundResponse,
  nextOutboundAttemptAt,
  OUTBOUND_MAX_AGE_MS,
  OUTBOUND_MAX_BODY,
  partnerWebhookUrl,
  signCabibeeWebhookBody,
  type OutboundEventName,
} from "@/lib/beeagent-outbound-policy";
import { getPartnerWebhookSecret } from "@/lib/beeagent-partner";
import { listDueOutboundRows, saveOutboundRow, type OutboundWebhookRow } from "@/lib/beeagent-outbound-store";
import type { BookingRecord } from "@/lib/booking-types";
import type { HostEntitlementRecord } from "@/lib/host-entitlement-types";

function nowIso() {
  return new Date().toISOString();
}

function eventId() {
  return `evt_${randomBytes(12).toString("hex")}`;
}

function bookingStatus(booking: BookingRecord): string {
  return booking.status === "PENDING" ? "PENDING_HOST" : booking.status;
}

function paymentStatus(booking: BookingRecord): string {
  if (booking.paymentStatus) return booking.paymentStatus;
  if (booking.refundedAt) return "refunded";
  if (booking.paidAt) return "paid";
  return "unpaid";
}

function contractStatus(booking: BookingRecord): string {
  if (booking.contractStatus) return booking.contractStatus;
  const c = booking.contract;
  if (c?.hostAcceptedAt && c.guestAcceptedAt) return "signed";
  return booking.contract ? "pending" : "not_required";
}

export function bookingOutboundData(booking: BookingRecord) {
  return {
    status: bookingStatus(booking),
    payment_status: paymentStatus(booking),
    contract_status: contractStatus(booking),
    total: booking.estimatedTotalMxn + (booking.platformFeeMxn ?? 0),
    currency: "MXN",
    check_in: booking.hostAdjustedCheckIn ?? booking.checkIn,
    check_out: booking.hostAdjustedCheckOut ?? booking.checkOut,
    listing_id: booking.hostAdjustedListingId ?? booking.listingId,
  };
}

function envelope(input: {
  eventId: string;
  event: OutboundEventName;
  occurredAt: string;
  hostId: string;
  customerId: number;
  booking?: BookingRecord;
  conversationKey?: string;
  data: unknown;
}) {
  return {
    event_id: input.eventId,
    event: input.event,
    occurred_at: input.occurredAt,
    host_id: input.hostId,
    beeagent_customer_id: input.customerId,
    booking_id: input.booking?.id ?? null,
    ref: input.booking?.beeagentRef ?? null,
    conversation_key: input.conversationKey ?? input.booking?.conversationKey ?? null,
    data: input.data,
  };
}

function persistAndKick(row: OutboundWebhookRow) {
  saveOutboundRow(row);
  void flushDueOutboundWebhooks();
}

export function enqueueBookingOutbound(event: OutboundEventName, booking: BookingRecord): void {
  const link = getBeeagentLinkForHost(booking.hostId);
  if (!link) return;
  const occurredAt = nowIso();
  const id = eventId();
  persistAndKick({
    eventId: id,
    event,
    hostId: booking.hostId,
    beeagentCustomerId: link.beeagentCustomerId,
    bookingId: booking.id,
    occurredAt,
    payload: envelope({
      eventId: id,
      event,
      occurredAt,
      hostId: booking.hostId,
      customerId: link.beeagentCustomerId,
      booking,
      data: bookingOutboundData(booking),
    }),
    status: "pending",
    attempts: 0,
    nextAttemptAt: occurredAt,
    createdAt: occurredAt,
  });
}

export function enqueueHostUnlinked(hostId: string, customerId: number): void {
  const occurredAt = nowIso();
  const id = eventId();
  persistAndKick({
    eventId: id,
    event: "host.unlinked",
    hostId,
    beeagentCustomerId: customerId,
    occurredAt,
    payload: envelope({
      eventId: id,
      event: "host.unlinked",
      occurredAt,
      hostId,
      customerId,
      data: {},
    }),
    status: "pending",
    attempts: 0,
    nextAttemptAt: occurredAt,
    createdAt: occurredAt,
  });
}

export function enqueueEntitlementsChanged(hostId: string, entitlements: HostEntitlementRecord[]): void {
  const link = getBeeagentLinkForHost(hostId);
  if (!link) return;
  const occurredAt = nowIso();
  const id = eventId();
  persistAndKick({
    eventId: id,
    event: "host.entitlements_changed",
    hostId,
    beeagentCustomerId: link.beeagentCustomerId,
    occurredAt,
    payload: envelope({
      eventId: id,
      event: "host.entitlements_changed",
      occurredAt,
      hostId,
      customerId: link.beeagentCustomerId,
      data: {
        entitlements: entitlements.map((e) => ({
          sku: e.sku,
          status: e.status,
          current_period_end: e.currentPeriodEnd ?? null,
        })),
      },
    }),
    status: "pending",
    attempts: 0,
    nextAttemptAt: occurredAt,
    createdAt: occurredAt,
  });
}

/** Eventos del chat del anuncio (huésped ↔ anfitrión) para la central de chat de urbnbeeai. */
export function enqueueChatOutbound(
  event: Extract<OutboundEventName, "message.created" | "conversation.ai_changed">,
  hostId: string,
  conversationKey: string,
  data: unknown
): void {
  const link = getBeeagentLinkForHost(hostId);
  if (!link) return;
  const occurredAt = nowIso();
  const id = eventId();
  persistAndKick({
    eventId: id,
    event,
    hostId,
    beeagentCustomerId: link.beeagentCustomerId,
    occurredAt,
    payload: envelope({ eventId: id, event, occurredAt, hostId, customerId: link.beeagentCustomerId, conversationKey, data }),
    status: "pending",
    attempts: 0,
    nextAttemptAt: occurredAt,
    createdAt: occurredAt,
  });
}

async function deliverOne(row: OutboundWebhookRow): Promise<void> {
  const createdMs = Date.parse(row.createdAt);
  if (Number.isFinite(createdMs) && Date.now() - createdMs >= OUTBOUND_MAX_AGE_MS) {
    saveOutboundRow({ ...row, status: "dead", lastError: "expired_24h" });
    return;
  }

  const secret = getPartnerWebhookSecret();
  if (!secret) {
    const next = nextOutboundAttemptAt(row.attempts + 1, createdMs);
    saveOutboundRow({
      ...row,
      attempts: row.attempts + 1,
      nextAttemptAt: next ?? row.nextAttemptAt,
      status: next ? "pending" : "dead",
      lastError: "no_webhook_secret",
    });
    return;
  }

  const raw = JSON.stringify(row.payload);
  if (Buffer.byteLength(raw, "utf8") > OUTBOUND_MAX_BODY) {
    saveOutboundRow({ ...row, status: "dead", lastError: "body_too_large" });
    return;
  }

  let http = 0;
  try {
    const res = await fetch(partnerWebhookUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cabibee-Signature": signCabibeeWebhookBody(secret, raw),
      },
      body: raw,
    });
    http = res.status;
    await res.text().catch(() => "");
  } catch (e) {
    const next = nextOutboundAttemptAt(row.attempts + 1, createdMs);
    saveOutboundRow({
      ...row,
      attempts: row.attempts + 1,
      nextAttemptAt: next ?? row.nextAttemptAt,
      status: next ? "pending" : "dead",
      lastError: e instanceof Error ? e.message.slice(0, 200) : "network",
    });
    return;
  }

  const verdict = classifyOutboundResponse(http);
  if (verdict === "delivered") {
    saveOutboundRow({
      ...row,
      status: "delivered",
      attempts: row.attempts + 1,
      lastHttp: http,
      lastError: undefined,
      deliveredAt: nowIso(),
    });
    return;
  }
  if (verdict === "drop") {
    saveOutboundRow({
      ...row,
      status: "dead",
      attempts: row.attempts + 1,
      lastHttp: http,
      lastError: `drop_${http}`,
    });
    return;
  }
  const next = nextOutboundAttemptAt(row.attempts + 1, createdMs);
  saveOutboundRow({
    ...row,
    attempts: row.attempts + 1,
    nextAttemptAt: next ?? row.nextAttemptAt,
    status: next ? "pending" : "dead",
    lastHttp: http,
    lastError: next ? `retry_${http}` : "expired_24h",
  });
}

let flushing = false;

export async function flushDueOutboundWebhooks(): Promise<{ due: number; delivered: number }> {
  if (flushing) return { due: 0, delivered: 0 };
  flushing = true;
  try {
    const due = await listDueOutboundRows();
    let delivered = 0;
    for (const row of due) {
      const before = row.status;
      await deliverOne(row);
      if (before === "pending") delivered += 1;
    }
    return { due: due.length, delivered };
  } finally {
    flushing = false;
  }
}

let workerStarted = false;

export function startOutboundWebhookWorker(): void {
  if (workerStarted) return;
  workerStarted = true;
  void flushDueOutboundWebhooks();
  setInterval(() => {
    void flushDueOutboundWebhooks();
  }, 60_000);
}
