import "server-only";
import { sumStayMxn } from "@/lib/booking-helpers";
import type { BookingTaxLine } from "@/lib/booking-types";
import { getHostProfile } from "@/lib/marketplace-store";
import type { HostListingRecord } from "@/lib/marketplace-types";
import { computeStayTax } from "@/lib/stay-tax";

export type BookingQuote = {
  nights: number;
  staySubtotal: number;
  cleaningMxn: number;
  /** Estancia + limpieza + impuestos sumados encima: lo que se guarda como `estimatedTotalMxn`. */
  totalMxn: number;
  taxMxn: number;
  taxLines: BookingTaxLine[];
  taxIncluded: boolean;
  /** Impuestos que se suman encima (0 si el precio ya los traía). */
  taxAddedMxn: number;
};

/** Total de la estancia con los impuestos que configuró el anfitrión. */
export function quoteBookingMxn(listing: HostListingRecord, checkIn: string, checkOut: string): BookingQuote {
  const { nights, staySubtotal } = sumStayMxn(listing, checkIn, checkOut);
  const cleaningMxn = listing.cleaningFee ?? 0;
  const subtotal = Math.round(staySubtotal + cleaningMxn);
  const tax = computeStayTax(getHostProfile(listing.hostId)?.tax, subtotal);
  return {
    nights,
    staySubtotal,
    cleaningMxn,
    totalMxn: subtotal + tax.addedMxn,
    taxMxn: tax.taxMxn,
    taxLines: tax.lines,
    taxIncluded: tax.included,
    taxAddedMxn: tax.addedMxn,
  };
}

/** Campos de impuesto para guardar en la reserva. */
export function bookingTaxFields(q: BookingQuote) {
  return q.taxMxn > 0
    ? { taxMxn: q.taxMxn, taxLines: q.taxLines, taxIncluded: q.taxIncluded }
    : { taxMxn: undefined, taxLines: undefined, taxIncluded: undefined };
}
