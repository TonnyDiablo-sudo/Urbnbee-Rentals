import "server-only";
import type Stripe from "stripe";
import type { BookingRecord } from "@/lib/booking-types";
import { getBookingById } from "@/lib/bookings-store";
import {
  notifyGuestScreeningRequested,
  notifyHostScreeningConsented,
  notifyHostScreeningReady,
} from "@/lib/push";
import {
  findReusableGuestScreening,
  getScreeningByBooking,
  getScreeningById,
  getScreeningBySession,
  getScreeningPrice,
  insertScreening,
  patchScreening,
  screeningAmount,
  screeningOffered,
} from "@/lib/screening-store";
import {
  SCREENING_CONSENT_VERSION,
  SCREENING_KIND,
  screeningPayerOf,
  type ScreeningBand,
  type ScreeningPayer,
  type ScreeningPublicView,
  type ScreeningQuote,
  type ScreeningRecord,
} from "@/lib/screening-types";
import type { VerificationRegion } from "@/lib/verification-types";

export const SCREENING_CONSENT_TEXT =
  "Autorizo a Cabibee a pedir un screening de crédito o antecedentes a un proveedor externo, solo para esta reserva o para mostrar un resumen al anfitrión. Cabibee no es el buró: no guarda el expediente completo, solo el resultado resumido (apto / revisar / no recomendado), la fecha y este consentimiento. Puedo negar el permiso; en ese caso el anfitrión no verá screening.";

export function screeningPublicView(row: ScreeningRecord): ScreeningPublicView {
  const paid = Boolean(row.paidAt) || row.status === "paid" || row.status === "completed";
  const showBand = row.status === "completed" || row.status === "paid";
  const payer = screeningPayerOf(row);
  const awaitingPay = Boolean(row.consentedAt) && !paid && row.status !== "failed";
  return {
    id: row.id,
    bookingId: row.bookingId,
    status: row.status,
    payer,
    consentedAt: row.consentedAt,
    paidAt: row.paidAt,
    band: showBand ? row.band : undefined,
    providerNote: row.providerNote,
    updatedAt: row.updatedAt,
    needsConsent: !row.consentedAt && (row.status === "requested" || row.status === "consented"),
    needsPayGuest: awaitingPay && payer === "guest",
    needsPayHost: awaitingPay && payer === "host",
  };
}

export const screeningHostView = screeningPublicView;

export function parseScreeningPayer(raw: unknown): ScreeningPayer | undefined {
  if (raw === "host" || raw === "guest") return raw;
  return undefined;
}

export function requestScreeningForBooking(
  booking: BookingRecord,
  payer: ScreeningPayer
): ScreeningRecord {
  const existing = getScreeningByBooking(booking.id);
  if (existing) return existing;

  if (!booking.guestUserId) {
    throw new Error("NO_GUEST");
  }

  const reusable = findReusableGuestScreening(booking.guestUserId);
  if (reusable?.band && reusable.status === "completed") {
    return insertScreening({
      guestUserId: booking.guestUserId,
      bookingId: booking.id,
      hostId: booking.hostId,
      payer,
      status: "completed",
      consentVersion: reusable.consentVersion,
      consentedAt: reusable.consentedAt,
      consentedIp: reusable.consentedIp,
      paidAt: reusable.paidAt,
      paidByUserId: reusable.paidByUserId,
      amountCharged: reusable.amountCharged,
      providerCostCharged: reusable.providerCostCharged,
      markupCharged: reusable.markupCharged,
      currency: reusable.currency,
      band: reusable.band,
      provider: reusable.provider,
      providerNote: "Se reutilizó un screening de los últimos 90 días, con el mismo consentimiento.",
    });
  }

  const row = insertScreening({
    guestUserId: booking.guestUserId,
    bookingId: booking.id,
    hostId: booking.hostId,
    payer,
    status: "requested",
    provider: "pending",
  });
  notifyGuestScreeningRequested(booking, payer === "guest");
  return row;
}

function guestNameFor(row: ScreeningRecord): string {
  return (row.bookingId && getBookingById(row.bookingId)?.guestName) || "El huésped";
}

export function guestConsentScreening(
  id: string,
  guestUserId: string,
  ip: string
): ScreeningRecord | undefined {
  const row = getScreeningById(id);
  if (!row || row.guestUserId !== guestUserId) return undefined;
  if (row.consentedAt) return row;
  const next = patchScreening(id, {
    status: row.status === "requested" ? "consented" : row.status,
    consentVersion: SCREENING_CONSENT_VERSION,
    consentedAt: new Date().toISOString(),
    consentedIp: ip,
  });
  if (next?.hostId) {
    notifyHostScreeningConsented({
      hostId: next.hostId,
      guestName: guestNameFor(next),
      hostPays: screeningPayerOf(next) === "host",
    });
  }
  return next;
}

export function completeScreeningAfterPayment(
  id: string,
  opts: {
    simulated: boolean;
    amount: number;
    providerCost?: number;
    markup?: number;
    currency: "mxn" | "usd";
    sessionId?: string;
    paidByUserId?: string;
  }
): ScreeningRecord | undefined {
  const row = getScreeningById(id);
  if (!row) return undefined;
  const quote = screeningQuote(opts.currency === "usd" ? "us" : "mx");
  const band: ScreeningBand = opts.simulated ? "revisar" : "pendiente_proveedor";
  if (row.hostId && row.status !== "completed") {
    notifyHostScreeningReady({ hostId: row.hostId, guestName: guestNameFor(row) });
  }
  return patchScreening(id, {
    status: "completed",
    paidAt: row.paidAt ?? new Date().toISOString(),
    paidByUserId: opts.paidByUserId ?? row.paidByUserId,
    amountCharged: opts.amount,
    providerCostCharged: opts.providerCost ?? quote.providerCost,
    markupCharged: opts.markup ?? quote.markup,
    currency: opts.currency,
    stripeCheckoutSessionId: opts.sessionId ?? row.stripeCheckoutSessionId,
    band,
    provider: opts.simulated ? "simulated" : "pending",
    providerNote: opts.simulated
      ? "Resultado de prueba. El proveedor real (buró) se conecta después. Cabibee no consultó ningún buró."
      : "Pago recibido. El expediente lo entrega el proveedor; aquí solo veremos el resumen.",
  });
}

export function screeningQuote(region: VerificationRegion): ScreeningQuote {
  const catalog = getScreeningPrice();
  const currency = region === "us" ? "usd" : "mxn";
  return {
    offered: screeningOffered(region),
    amount: screeningAmount(region),
    providerCost: region === "us" ? catalog.providerCostUsd : catalog.providerCostMxn,
    markup: region === "us" ? catalog.markupUsd : catalog.markupMxn,
    currency,
  };
}

export function canRequestScreening(booking: BookingRecord): boolean {
  if (!booking.guestUserId) return false;
  if (booking.status === "REJECTED" || booking.status === "CANCELLED") return false;
  return !getScreeningByBooking(booking.id);
}

export function settleScreeningCheckoutSession(session: Stripe.Checkout.Session):
  | { ok: true; kind: "completed" | "already_settled"; screening: ScreeningRecord }
  | { ok: false; status: number; error: string } {
  if (session.metadata?.kind !== SCREENING_KIND) {
    return { ok: false, status: 400, error: "Esta sesión no es de screening." };
  }
  if (session.payment_status !== "paid") {
    return { ok: false, status: 409, error: "El pago no está completado." };
  }
  const id = typeof session.metadata.screeningId === "string" ? session.metadata.screeningId : "";
  const row = (id ? getScreeningById(id) : undefined) ?? getScreeningBySession(session.id);
  if (!row) {
    return { ok: false, status: 404, error: "Screening no encontrado." };
  }
  if (row.status === "completed" && row.paidAt) {
    return { ok: true, kind: "already_settled", screening: row };
  }
  const amount = (session.amount_total ?? 0) / 100;
  const currency = session.currency === "usd" ? "usd" : "mxn";
  const next = completeScreeningAfterPayment(row.id, {
    simulated: false,
    amount,
    currency,
    sessionId: session.id,
    paidByUserId: typeof session.metadata?.userId === "string" ? session.metadata.userId : undefined,
  });
  if (!next) {
    return { ok: false, status: 409, error: "No se pudo actualizar el screening." };
  }
  return { ok: true, kind: "completed", screening: next };
}
