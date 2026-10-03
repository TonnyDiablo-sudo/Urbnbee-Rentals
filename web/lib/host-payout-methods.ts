import "server-only";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { BookingRecord, ManualPayMethod } from "@/lib/booking-types";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

/** Formas de cobro manual que se guardaban antes de que el motor fuera sólo en línea. */
const DATA_FILE = join(getDataDir(), "host-payout-methods.json");

const METHOD_LABEL: Record<ManualPayMethod | "stripe", string> = {
  stripe: "Stripe",
  clabe: "CLABE",
  zelle: "Zelle",
  cashapp: "Cash App",
  oxxo: "Oxxo",
};

/** Al borrar una cuenta, quita las formas de cobro manual que hubiera guardado. */
export function deleteHostPayoutMethods(hostId: string): void {
  try {
    if (!existsSync(DATA_FILE)) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { methods?: { hostId?: string }[] };
    const methods = data.methods ?? [];
    const rest = methods.filter((m) => m?.hostId !== hostId);
    if (rest.length === methods.length) return;
    ensureDir(getDataDir());
    writeFileSync(DATA_FILE, JSON.stringify({ version: 1, methods: rest }, null, 2), "utf8");
  } catch (e) {
    console.warn("[host-payout-methods] delete failed:", e);
  }
}

export function payMethodLabel(method: ManualPayMethod | "stripe"): string {
  return METHOD_LABEL[method];
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  });
}

/**
 * Anexo que se muestra después del contrato. No entra a `contractPlainLines`,
 * así que no cambia el hash de lo que firmaron.
 */
export function paymentNoteLines(booking: BookingRecord): string[] {
  const c = booking.payConfirmation;
  const head = ["", "Nota de pago (no cambia el texto firmado)"];
  if (c?.by === "stripe" || (booking.paidAt && booking.stripeCheckoutSessionId && c?.by !== "host")) {
    return [...head, `Ya se pagó por Stripe el ${fmtWhen(c?.at ?? booking.paidAt!)}`];
  }
  if (c?.by === "host") {
    return [...head, `El anfitrión confirmó el pago (${payMethodLabel(c.method)}) el ${fmtWhen(c.at)}`];
  }
  if (booking.paidAt) {
    return [...head, `Ya se pagó el ${fmtWhen(booking.paidAt)}`];
  }
  return [];
}
