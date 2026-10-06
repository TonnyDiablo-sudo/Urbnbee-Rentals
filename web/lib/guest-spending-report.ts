import "server-only";
import { paidStayOf } from "@/lib/booking-adjustments";
import type { BookingRecord } from "@/lib/booking-types";
import { listBookingsForGuest } from "@/lib/bookings-store";
import { publicNameOf } from "@/lib/display-name";
import type { TFn } from "@/lib/i18n";
import { findUserById, getListingById } from "@/lib/marketplace-store";

export type SpendingRow = {
  id: string;
  token: string;
  status: string;
  listingTitle: string;
  city: string;
  hostName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  stayMxn: number;
  feeMxn: number;
  taxMxn: number;
  paidMxn: number;
  refundedMxn: number;
  netMxn: number;
  method: string;
  paidAt: string;
};

const round = (n: number) => Math.round(n * 100) / 100;

const METHOD: Record<string, string> = { stripe: "Tarjeta", clabe: "Transferencia", zelle: "Zelle", cashapp: "Cash App", oxxo: "Oxxo" };

function rowOf(b: BookingRecord): SpendingRow {
  const listing = getListingById(b.hostAdjustedListingId ?? b.listingId) ?? getListingById(b.listingId);
  const adjustments = b.adjustments ?? [];
  const extraFees = adjustments.filter((a) => a.kind === "charge" && a.status === "paid").reduce((s, a) => s + a.feeMxn, 0);
  const stay = paidStayOf(b);
  const fee = (b.platformFeeMxn ?? 0) + extraFees;
  const paid = stay + fee;
  const refunded = Math.min(
    paid,
    (b.refundAmountMxn ?? (b.refundedAt ? paid : 0)) +
      adjustments.filter((a) => a.kind === "refund" && a.status === "refunded").reduce((s, a) => s + a.amountMxn + a.feeMxn, 0)
  );
  const method = b.payConfirmation?.method ?? (b.stripeCheckoutSessionId ? "stripe" : "");
  return {
    id: b.id,
    token: b.token,
    status: b.status,
    listingTitle: listing?.title ?? "Alojamiento",
    city: listing?.city ?? "",
    hostName: publicNameOf(findUserById(b.hostId)) || "",
    checkIn: b.hostAdjustedCheckIn ?? b.checkIn,
    checkOut: b.hostAdjustedCheckOut ?? b.checkOut,
    nights: b.nights,
    stayMxn: round(stay),
    feeMxn: round(fee),
    taxMxn: round(b.taxMxn ?? 0),
    paidMxn: round(paid),
    refundedMxn: round(refunded),
    netMxn: round(paid - refunded),
    method: METHOD[method] ?? method,
    paidAt: b.paidAt?.slice(0, 10) ?? "",
  };
}

/** Sólo cuenta lo que de verdad se pagó. */
function paidBookings(userId: string): BookingRecord[] {
  return listBookingsForGuest(userId).filter((b) => Boolean(b.paidAt));
}

export function spendingYears(userId: string): number[] {
  const years = new Set(paidBookings(userId).map((b) => Number(b.paidAt!.slice(0, 4))));
  return [...years].filter(Number.isFinite).sort((a, b) => b - a);
}

/** Pagos del año (por fecha de pago), del más reciente al más viejo; `year` null = todos. */
export function spendingRows(userId: string, year: number | null): SpendingRow[] {
  return paidBookings(userId)
    .filter((b) => year === null || b.paidAt!.startsWith(`${year}-`))
    .sort((a, b) => b.paidAt!.localeCompare(a.paidAt!))
    .map(rowOf);
}

export function spendingSummary(rows: SpendingRow[]) {
  return {
    trips: rows.filter((r) => r.netMxn > 0).length,
    nights: rows.filter((r) => r.netMxn > 0).reduce((n, r) => n + r.nights, 0),
    paidMxn: round(rows.reduce((n, r) => n + r.paidMxn, 0)),
    refundedMxn: round(rows.reduce((n, r) => n + r.refundedMxn, 0)),
    netMxn: round(rows.reduce((n, r) => n + r.netMxn, 0)),
  };
}

function cell(v: string | number): string {
  const s = String(v);
  const safe = /^[=+\-@\t\r]/.test(s) && typeof v === "string" ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV con BOM para que Excel abra bien los acentos. */
export function spendingCsv(rows: SpendingRow[], t: TFn): string {
  const header = [
    "Código",
    "Alojamiento",
    "Ciudad",
    "Anfitrión",
    "Llegada",
    "Salida",
    "Noches",
    "Estancia (MXN)",
    "Cargo de servicio (MXN)",
    "Impuestos incluidos (MXN)",
    "Pagado (MXN)",
    "Devuelto (MXN)",
    "Gasto neto (MXN)",
    "Método",
    "Fecha de pago",
  ].map((h) => cell(t(h)));
  const lines = rows.map((r) =>
    [
      r.token,
      r.listingTitle,
      r.city,
      r.hostName,
      r.checkIn,
      r.checkOut,
      r.nights,
      r.stayMxn.toFixed(2),
      r.feeMxn.toFixed(2),
      r.taxMxn.toFixed(2),
      r.paidMxn.toFixed(2),
      r.refundedMxn.toFixed(2),
      r.netMxn.toFixed(2),
      t(r.method),
      r.paidAt,
    ]
      .map(cell)
      .join(",")
  );
  return "\uFEFF" + [header.join(","), ...lines].join("\r\n") + "\r\n";
}
