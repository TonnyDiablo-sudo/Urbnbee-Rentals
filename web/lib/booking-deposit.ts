import "server-only";
import {
  DEPOSIT_CLAIM_WINDOW_HOURS,
  DEPOSIT_CUSTODY_NOTE,
  type BookingDepositRecord,
} from "@/lib/booking-deposit-types";
import { completeStayIfDue, expireUnpaidIfDue } from "@/lib/booking-machine";
import type { BookingRecord } from "@/lib/booking-types";
import { getBookingById, patchBookingRecord } from "@/lib/bookings-store";

function nowIso() {
  return new Date().toISOString();
}

function addHours(isoDate: string, hours: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString();
}

export function checkoutDateOf(booking: BookingRecord): string {
  return booking.hostAdjustedCheckOut ?? booking.checkOut;
}

export function stayHasEnded(booking: BookingRecord, now = new Date()): boolean {
  const out = checkoutDateOf(booking);
  const end = new Date(`${out}T12:00:00.000Z`);
  return now.getTime() >= end.getTime();
}

export function buildDeclaredDeposit(booking: BookingRecord): BookingDepositRecord | undefined {
  const amount = booking.contract?.snapshot.depositMxn ?? 0;
  if (amount <= 0) return undefined;
  return {
    amountMxn: amount,
    note: booking.contract?.snapshot.depositNote || DEPOSIT_CUSTODY_NOTE,
    windowHours: DEPOSIT_CLAIM_WINDOW_HOURS,
    checkoutDate: checkoutDateOf(booking),
    status: "declared",
  };
}

export function advanceDepositRecord(
  booking: BookingRecord,
  now = new Date()
): { deposit?: BookingDepositRecord } {
  const patch: { deposit?: BookingDepositRecord } = {};
  const ended = stayHasEnded(booking, now);

  let deposit = booking.deposit ?? buildDeclaredDeposit(booking);
  if (!deposit) return patch;

  if (ended && !deposit.windowEndsAt) {
    deposit = {
      ...deposit,
      windowEndsAt: addHours(deposit.checkoutDate, deposit.windowHours),
      status: deposit.status === "declared" ? "window_open" : deposit.status,
    };
  }

  if (
    deposit.status === "window_open" &&
    deposit.windowEndsAt &&
    now.getTime() >= new Date(deposit.windowEndsAt).getTime()
  ) {
    deposit = {
      ...deposit,
      status: "released",
      releasedAt: deposit.releasedAt ?? nowIso(),
    };
  }

  patch.deposit = deposit;
  return patch;
}

export function applyBookingLifecycle(booking: BookingRecord): BookingRecord {
  const expired = expireUnpaidIfDue(booking);
  const completed = completeStayIfDue(expired, stayHasEnded(expired));
  const patch = advanceDepositRecord(completed);
  const sameDeposit = JSON.stringify(patch.deposit ?? null) === JSON.stringify(completed.deposit ?? null);
  if (sameDeposit) return completed;
  return patchBookingRecord(completed.id, { deposit: patch.deposit }) ?? completed;
}

export function attachDepositIfNeeded(booking: BookingRecord): BookingRecord {
  if (booking.deposit || !booking.contract) return booking;
  const deposit = buildDeclaredDeposit(booking);
  if (!deposit) return booking;
  return patchBookingRecord(booking.id, { deposit }) ?? booking;
}

export function hostClaimDeposit(
  bookingId: string,
  opts: { note: string }
): { booking?: BookingRecord; error?: string; status?: number } {
  const live = getBookingById(bookingId);
  if (!live) return { error: "Reserva no encontrada.", status: 404 };

  const next = applyBookingLifecycle(live);
  const deposit = next.deposit;
  if (!deposit || deposit.amountMxn <= 0) {
    return { error: "Esta reserva no tiene depósito declarado.", status: 409 };
  }
  if (deposit.status === "released" || deposit.status === "closed") {
    return { error: "La ventana de depósito ya se cerró.", status: 409 };
  }
  if (deposit.status !== "window_open" && deposit.status !== "declared") {
    return { error: "Ya hay un reclamo de depósito.", status: 409 };
  }
  if (!stayHasEnded(next)) {
    return { error: "El reclamo se abre hasta que termine la estancia.", status: 409 };
  }
  if (deposit.windowEndsAt && Date.now() > new Date(deposit.windowEndsAt).getTime()) {
    const released = patchBookingRecord(next.id, {
      deposit: { ...deposit, status: "released", releasedAt: nowIso() },
    });
    return { error: "Se acabó la ventana de 48 horas. El depósito queda como liberado entre las partes.", status: 409, booking: released };
  }

  const note = opts.note.trim().slice(0, 2000);
  if (note.length < 10) {
    return { error: "Describe el daño o el motivo (mínimo 10 caracteres).", status: 400 };
  }

  const afterStay = completeStayIfDue(next, true);
  const updated = patchBookingRecord(afterStay.id, {
    deposit: {
      ...deposit,
      status: "claimed",
      windowEndsAt: deposit.windowEndsAt ?? addHours(deposit.checkoutDate, deposit.windowHours),
      claim: { at: nowIso(), hostNote: note },
    },
  });
  return { booking: updated };
}

export function guestReplyDeposit(
  bookingId: string,
  opts: { note: string }
): { booking?: BookingRecord; error?: string; status?: number } {
  const live = getBookingById(bookingId);
  if (!live) return { error: "Reserva no encontrada.", status: 404 };
  const next = applyBookingLifecycle(live);
  const deposit = next.deposit;
  if (!deposit?.claim) return { error: "No hay un reclamo que responder.", status: 409 };
  if (deposit.guestReply) return { error: "Ya respondiste este reclamo.", status: 409 };
  if (deposit.status === "released" || deposit.status === "closed") {
    return { error: "Este caso de depósito ya está cerrado.", status: 409 };
  }

  const note = opts.note.trim().slice(0, 2000);
  if (note.length < 5) {
    return { error: "Escribe tu respuesta.", status: 400 };
  }

  const updated = patchBookingRecord(next.id, {
    deposit: {
      ...deposit,
      status: "guest_replied",
      guestReply: { at: nowIso(), note },
    },
  });
  return { booking: updated };
}

export function hostCloseDeposit(
  bookingId: string,
  kind: "released" | "closed"
): { booking?: BookingRecord; error?: string; status?: number } {
  const live = getBookingById(bookingId);
  if (!live) return { error: "Reserva no encontrada.", status: 404 };
  const next = applyBookingLifecycle(live);
  const deposit = next.deposit;
  if (!deposit) return { error: "No hay depósito.", status: 409 };
  if (deposit.status === "released" || deposit.status === "closed") {
    return { booking: next };
  }

  const now = nowIso();
  const updated = patchBookingRecord(next.id, {
    deposit: {
      ...deposit,
      status: kind,
      releasedAt: kind === "released" ? now : deposit.releasedAt,
      closedAt: now,
    },
  });
  return { booking: updated };
}

export function depositPublicLabel(d: BookingDepositRecord | undefined): string {
  if (!d || d.amountMxn <= 0) return "Sin depósito declarado";
  const money = `$${d.amountMxn.toLocaleString("es-MX")} MXN`;
  switch (d.status) {
    case "declared":
      return `${money} · se entrega entre las partes`;
    case "window_open":
      return `${money} · ventana de reclamo abierta`;
    case "claimed":
      return `${money} · reclamo del anfitrión`;
    case "guest_replied":
      return `${money} · el huésped ya respondió`;
    case "released":
      return `${money} · sin reclamo, liberado entre las partes`;
    case "closed":
      return `${money} · caso cerrado (documentado)`;
    default:
      return money;
  }
}
