import "server-only";
import type { BookingRecord, BookingStatus } from "@/lib/booking-types";
import { listBookingsForHost } from "@/lib/bookings-store";
import type { TFn } from "@/lib/i18n";
import { getListingById } from "@/lib/marketplace-store";

const STATUS_LABEL: Record<BookingStatus, string> = {
  AWAITING_PAYMENT: "Esperando pago",
  PENDING: "Pendiente",
  PENDING_HOST: "Por aceptar",
  AWAITING_DETAILS: "Esperando datos",
  CONFIRMED: "Confirmada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  COMPLETED: "Terminada",
  EXPIRED: "Vencida",
};

export type EarningsRow = {
  id: string;
  status: BookingStatus;
  listingTitle: string;
  city: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  stayMxn: number;
  cleaningMxn: number;
  taxMxn: number;
  totalMxn: number;
  collectedMxn: number;
  refundedMxn: number;
  netMxn: number;
  paidAt: string;
  createdAt: string;
};

const round = (n: number) => Math.round(n * 100) / 100;

function isPaid(b: BookingRecord): boolean {
  return Boolean(b.paidAt) || b.paymentStatus === "paid" || b.paymentStatus === "refunded" || b.paymentStatus === "partially_refunded";
}

/** Lo que cuenta: reservas pagadas por el motor de reservas, o confirmadas/terminadas. */
function counts(b: BookingRecord): boolean {
  return isPaid(b) || b.status === "CONFIRMED" || b.status === "COMPLETED";
}

function rowOf(b: BookingRecord): EarningsRow {
  const listing = getListingById(b.listingId);
  const tax = b.taxMxn ?? 0;
  const collected = isPaid(b) ? (b.paidStayMxn ?? b.estimatedTotalMxn) : 0;
  /** La devolución incluye el cargo de plataforma, que nunca fue del anfitrión. */
  const refunded = b.refundAmountMxn ? Math.min(collected, Math.max(0, b.refundAmountMxn - (b.platformFeeMxn ?? 0))) : 0;
  return {
    id: b.id,
    status: b.status,
    listingTitle: listing?.title ?? b.listingId,
    city: listing?.city ?? "",
    guestName: b.guestName,
    guestEmail: b.guestEmail,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    nights: b.nights,
    stayMxn: round(b.estimatedTotalMxn - b.cleaningFeeMxn - tax),
    cleaningMxn: round(b.cleaningFeeMxn),
    taxMxn: round(tax),
    totalMxn: round(b.estimatedTotalMxn),
    collectedMxn: round(collected),
    refundedMxn: round(refunded),
    netMxn: round(collected - refunded),
    paidAt: b.paidAt?.slice(0, 10) ?? "",
    createdAt: b.createdAt.slice(0, 10),
  };
}

/** Años con reservas (por fecha de llegada), del más reciente al más viejo. */
export function earningsYears(hostId: string): number[] {
  const years = new Set(listBookingsForHost(hostId).filter(counts).map((b) => Number(b.checkIn.slice(0, 4))));
  return [...years].filter(Number.isFinite).sort((a, b) => b - a);
}

/** Reservas del año (por llegada); `year` null = todas. */
export function earningsRows(hostId: string, year: number | null): EarningsRow[] {
  return listBookingsForHost(hostId)
    .filter((b) => counts(b) && (year === null || b.checkIn.startsWith(`${year}-`)))
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
    .map(rowOf);
}

export function earningsSummary(rows: EarningsRow[]) {
  /** Las canceladas con devolución completa no suman noches. */
  const stayed = rows.filter((r) => r.netMxn > 0 || (r.status !== "CANCELLED" && r.status !== "REJECTED"));
  return {
    bookings: stayed.length,
    nights: stayed.reduce((n, r) => n + r.nights, 0),
    netMxn: round(rows.reduce((n, r) => n + r.netMxn, 0)),
    taxMxn: round(stayed.reduce((n, r) => n + r.taxMxn, 0)),
  };
}

function cell(v: string | number): string {
  const s = String(v);
  /** Evita que Excel ejecute fórmulas escritas en un nombre. */
  const safe = /^[=+\-@\t\r]/.test(s) && typeof v === "string" ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV con BOM para que Excel abra bien los acentos. */
export function earningsCsv(rows: EarningsRow[], t: TFn): string {
  const header = [
    "Reserva",
    "Estado",
    "Anuncio",
    "Ciudad",
    "Huésped",
    "Correo del huésped",
    "Llegada",
    "Salida",
    "Noches",
    "Estancia (MXN)",
    "Limpieza (MXN)",
    "Impuestos (MXN)",
    "Total de la reserva (MXN)",
    "Cobrado (MXN)",
    "Devuelto (MXN)",
    "Ingreso neto (MXN)",
    "Fecha de pago",
    "Fecha de la solicitud",
  ].map((h) => cell(t(h)));
  const lines = rows.map((r) =>
    [
      r.id,
      t(STATUS_LABEL[r.status]),
      r.listingTitle,
      r.city,
      r.guestName,
      r.guestEmail,
      r.checkIn,
      r.checkOut,
      r.nights,
      r.stayMxn.toFixed(2),
      r.cleaningMxn.toFixed(2),
      r.taxMxn.toFixed(2),
      r.totalMxn.toFixed(2),
      r.collectedMxn.toFixed(2),
      r.refundedMxn.toFixed(2),
      r.netMxn.toFixed(2),
      r.paidAt,
      r.createdAt,
    ]
      .map(cell)
      .join(",")
  );
  return "\uFEFF" + [header.join(","), ...lines].join("\r\n") + "\r\n";
}
