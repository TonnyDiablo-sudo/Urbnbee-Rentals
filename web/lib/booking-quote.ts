import "server-only";
import { sumStayMxn } from "@/lib/booking-helpers";
import type { BookingRecord, BookingTaxLine } from "@/lib/booking-types";
import { getHostProfile } from "@/lib/marketplace-store";
import type { HostListingRecord } from "@/lib/marketplace-types";
import { computeStayTax, taxActive } from "@/lib/stay-tax";
import { pricingToday } from "@/lib/listing-pricing";

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
  /** El anfitrión tiene impuestos configurados (puede decidir si los cobra). */
  taxAvailable: boolean;
  /** En esta cotización sí se cobran impuestos. */
  chargesTax: boolean;
};

export type BookingQuoteOptions = {
  /** Día en que se reservó: decide reserva anticipada y última hora. */
  today?: string;
  /** Decisión del anfitrión para esta reserva; si no viene, se usa la del anuncio. */
  chargeTax?: boolean;
};

/** El anuncio cobra impuestos por defecto salvo que el anfitrión lo haya apagado. */
export function listingChargesTax(listing: HostListingRecord): boolean {
  return taxActive(getHostProfile(listing.hostId)?.tax) && listing.chargeTax !== false;
}

/** Si esta reserva cobra impuestos hoy (lo que se cotizó al reservar o lo que decidió el anfitrión). */
export function bookingChargesTax(booking: BookingRecord): boolean {
  if (typeof booking.chargeTax === "boolean") return booking.chargeTax;
  return (booking.taxMxn ?? 0) > 0;
}

/** Día (Ciudad de México) en que se creó la reserva. */
export function bookingQuoteDay(booking: Pick<BookingRecord, "createdAt">): string {
  const d = new Date(booking.createdAt);
  return Number.isNaN(d.getTime()) ? pricingToday() : pricingToday(d);
}

/** Total de la estancia con descuentos y los impuestos que configuró el anfitrión. */
export function quoteBookingMxn(
  listing: HostListingRecord,
  checkIn: string,
  checkOut: string,
  opts: BookingQuoteOptions = {}
): BookingQuote {
  const { nights, staySubtotal } = sumStayMxn(listing, checkIn, checkOut, { today: opts.today });
  const cleaningMxn = listing.cleaningFee ?? 0;
  const subtotal = Math.round(staySubtotal + cleaningMxn);
  const settings = getHostProfile(listing.hostId)?.tax;
  const taxAvailable = taxActive(settings);
  const chargesTax = taxAvailable && (opts.chargeTax ?? listing.chargeTax !== false);
  const tax = computeStayTax(chargesTax ? settings : undefined, subtotal);
  return {
    nights,
    staySubtotal,
    cleaningMxn,
    totalMxn: subtotal + tax.addedMxn,
    taxMxn: tax.taxMxn,
    taxLines: tax.lines,
    taxIncluded: tax.included,
    taxAddedMxn: tax.addedMxn,
    taxAvailable,
    chargesTax,
  };
}

/**
 * Mismas fechas y alojamiento: se respeta lo que costó la estancia al reservar y
 * sólo se ponen o quitan los impuestos, aunque el anfitrión haya cambiado tarifas.
 */
export function retaxBookingMxn(booking: BookingRecord, listing: HostListingRecord, chargeTax: boolean): BookingQuote {
  const subtotal = Math.max(0, booking.estimatedTotalMxn - (booking.taxIncluded ? 0 : (booking.taxMxn ?? 0)));
  const cleaningMxn = booking.cleaningFeeMxn ?? 0;
  const settings = getHostProfile(listing.hostId)?.tax;
  const taxAvailable = taxActive(settings);
  const chargesTax = taxAvailable && chargeTax;
  const tax = computeStayTax(chargesTax ? settings : undefined, subtotal);
  return {
    nights: booking.nights,
    staySubtotal: subtotal - cleaningMxn,
    cleaningMxn,
    totalMxn: subtotal + tax.addedMxn,
    taxMxn: tax.taxMxn,
    taxLines: tax.lines,
    taxIncluded: tax.included,
    taxAddedMxn: tax.addedMxn,
    taxAvailable,
    chargesTax,
  };
}

/** Campos de impuesto para guardar en la reserva. */
export function bookingTaxFields(q: BookingQuote) {
  return q.taxMxn > 0
    ? { taxMxn: q.taxMxn, taxLines: q.taxLines, taxIncluded: q.taxIncluded }
    : { taxMxn: undefined, taxLines: undefined, taxIncluded: undefined };
}
