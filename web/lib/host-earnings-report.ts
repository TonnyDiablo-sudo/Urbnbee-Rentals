import "server-only";
import type { BookingRecord, BookingStatus } from "@/lib/booking-types";
import { listBookingsForHost } from "@/lib/bookings-store";
import type { TFn } from "@/lib/i18n";
import { getListingById } from "@/lib/marketplace-store";

export const STATUS_LABEL: Record<BookingStatus, string> = {
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
  method?: string;
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
    method: b.payConfirmation?.method ?? (b.stripeCheckoutSessionId || b.stripePaymentIntentId ? "stripe" : undefined),
  };
}

/** Años con reservas (por fecha de llegada), del más reciente al más viejo. */
export function earningsYears(hostId: string): number[] {
  const years = new Set(listBookingsForHost(hostId).filter(counts).map((b) => Number(b.checkIn.slice(0, 4))));
  return [...years].filter(Number.isFinite).sort((a, b) => b - a);
}

/** Reservas del año (por llegada); `year` null = todas. Con `month` (1-12), sólo ese mes del año. */
export function earningsRows(hostId: string, year: number | null, month?: number | null): EarningsRow[] {
  const prefix = year === null ? "" : month ? `${year}-${String(month).padStart(2, "0")}-` : `${year}-`;
  return listBookingsForHost(hostId)
    .filter((b) => counts(b) && b.checkIn.startsWith(prefix))
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

export type EarningsMonth = {
  /** AAAA-MM */
  month: string;
  bookings: number;
  nights: number;
  collectedMxn: number;
  refundedMxn: number;
  netMxn: number;
  taxMxn: number;
};

/** Totales por mes de llegada, del más viejo al más reciente. */
export function earningsByMonth(rows: EarningsRow[]): EarningsMonth[] {
  const map = new Map<string, EarningsRow[]>();
  for (const r of rows) {
    const k = r.checkIn.slice(0, 7);
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, list]) => {
      const s = earningsSummary(list);
      return {
        month,
        bookings: s.bookings,
        nights: s.nights,
        collectedMxn: round(list.reduce((n, r) => n + r.collectedMxn, 0)),
        refundedMxn: round(list.reduce((n, r) => n + r.refundedMxn, 0)),
        netMxn: s.netMxn,
        taxMxn: s.taxMxn,
      };
    });
}

export function earningsMonthlyCsv(rows: EarningsRow[], t: TFn): string {
  const header = ["Mes", "Reservas", "Noches", "Cobrado (MXN)", "Devuelto (MXN)", "Impuestos (MXN)", "Ingreso neto (MXN)"].map((h) => cell(t(h)));
  const months = earningsByMonth(rows);
  const lines = months.map((m) =>
    [m.month, m.bookings, m.nights, m.collectedMxn.toFixed(2), m.refundedMxn.toFixed(2), m.taxMxn.toFixed(2), m.netMxn.toFixed(2)].map(cell).join(",")
  );
  const total = months.reduce(
    (a, m) => ({
      bookings: a.bookings + m.bookings,
      nights: a.nights + m.nights,
      collected: a.collected + m.collectedMxn,
      refunded: a.refunded + m.refundedMxn,
      tax: a.tax + m.taxMxn,
      net: a.net + m.netMxn,
    }),
    { bookings: 0, nights: 0, collected: 0, refunded: 0, tax: 0, net: 0 }
  );
  lines.push(
    [t("Total"), total.bookings, total.nights, total.collected.toFixed(2), total.refunded.toFixed(2), total.tax.toFixed(2), total.net.toFixed(2)]
      .map(cell)
      .join(",")
  );
  return "\uFEFF" + [header.join(","), ...lines].join("\r\n") + "\r\n";
}
