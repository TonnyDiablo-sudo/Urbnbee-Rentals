import "server-only";
import { randomBytes } from "crypto";
import type { BookingContractRecord, ContractStamp } from "@/lib/booking-contract-types";
import type { BookingRecord } from "@/lib/booking-types";
import { getBookingById, patchBookingRecord } from "@/lib/bookings-store";

const EVENT_TEXT: Record<ContractStamp["kind"], string> = {
  payment_received: "Sello del sistema: pago recibido.",
  payment_rejected: "Sello del sistema: pago rechazado.",
  voided: "Sello del sistema: contrato anulado por falta de pago.",
};

/**
 * Agrega un sello al contrato vigente. Los sellos no se pueden borrar: el de pago rechazado
 * sólo se cierra (queda en el contrato, marcado como resuelto) cuando entra el pago a tiempo.
 */
export function addContractStamp(bookingId: string, input: Omit<ContractStamp, "id" | "at">): BookingRecord | undefined {
  const booking = getBookingById(bookingId);
  if (!booking?.contract) return booking;
  const at = new Date().toISOString();
  const stamp: ContractStamp = { ...input, id: `st_${randomBytes(6).toString("hex")}`, at };
  const stamps = (booking.contract.stamps ?? []).map((s) =>
    input.kind === "payment_received" && s.kind === "payment_rejected" && !s.clearedAt
      ? { ...s, clearedAt: at, clearedByStampId: stamp.id }
      : s
  );
  const contract: BookingContractRecord = {
    ...booking.contract,
    stamps: [...stamps, stamp],
    events: [...booking.contract.events, { at, actor: "system", action: `stamp_${input.kind}`, detail: EVENT_TEXT[input.kind] }],
  };
  return patchBookingRecord(bookingId, { contract });
}

export function openPaymentRejection(c: BookingContractRecord | undefined): ContractStamp | undefined {
  return c?.stamps?.find((s) => s.kind === "payment_rejected" && !s.clearedAt);
}

function stamp(iso: string): string {
  return `${iso.slice(0, 19).replace("T", " ")} UTC`;
}

const money = (n: number) => `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN`;

/** Cláusula de vigencia: sólo en contratos nuevos (los firmados antes no cambian de texto). */
export function paymentClauseLines(c: BookingContractRecord): string[] {
  if (!c.paymentDueAt) return [];
  return [
    "VIGENCIA Y PAGO",
    "Las partes firman este contrato antes del pago, pero sólo surte efectos cuando se recibe el pago total de la estancia.",
    `El pago debe recibirse a más tardar el ${stamp(c.paymentDueAt)}. Si no se paga dentro de ese plazo, el contrato queda anulado sin responsabilidad para ninguna de las partes y las fechas se liberan.`,
    "Al recibirse el pago, el sistema imprime en este contrato un sello de pago recibido que nadie puede quitar.",
    "Si después el pago se rechaza o se revierte, el sistema imprime un sello de pago rechazado con un nuevo plazo. Ese sello sólo se cierra si el pago se completa dentro de ese plazo; si no, el contrato queda anulado.",
    "",
  ];
}

export function stampLines(c: BookingContractRecord): string[] {
  const list = c.stamps ?? [];
  if (!list.length) return [];
  return [
    "SELLOS DEL SISTEMA",
    ...list.map((s) => {
      if (s.kind === "payment_received") {
        return `[SELLO] PAGO RECIBIDO · ${stamp(s.at)}${s.amountMxn ? ` · ${money(s.amountMxn)}` : ""}${s.method ? ` · ${s.method}` : ""}${s.ref ? ` · ref. ${s.ref}` : ""}`;
      }
      if (s.kind === "payment_rejected") {
        return `[SELLO] PAGO RECHAZADO · ${stamp(s.at)}${s.reason ? ` · ${s.reason}` : ""}${
          s.clearedAt ? ` · cerrado el ${stamp(s.clearedAt)} al recibirse el pago` : s.dueAt ? ` · pagar antes del ${stamp(s.dueAt)}` : ""
        }`;
      }
      return `[SELLO] CONTRATO ANULADO · ${stamp(s.at)} · no se recibió el pago dentro del plazo`;
    }),
    "",
  ];
}
