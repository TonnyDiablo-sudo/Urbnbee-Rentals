import type { HostListingRecord } from "@/lib/marketplace-types";

type AddressParts = Pick<HostListingRecord, "addressLine" | "addressUnit" | "noAddressUnit" | "categoryKey"> &
  Partial<Pick<HostListingRecord, "zone" | "county" | "city" | "state" | "country">>;

/** Calle y número, con el número interior si lo hay: «Colima 123, Int. 4B». */
export function listingStreet(l: Pick<HostListingRecord, "addressLine" | "addressUnit">): string {
  const street = (l.addressLine ?? "").trim();
  const unit = (l.addressUnit ?? "").trim();
  if (!unit) return street;
  return street ? `${street}, Int. ${unit}` : `Int. ${unit}`;
}

export function listingFullAddress(l: AddressParts): string {
  return [listingStreet(l), l.zone, l.county, l.city, l.state, l.country]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(", ");
}

/** Los departamentos casi siempre tienen número interior; se pide salvo que el anfitrión diga que no tiene. */
export function listingNeedsUnit(l: Pick<HostListingRecord, "categoryKey">): boolean {
  return l.categoryKey === "departamentos";
}

/**
 * Qué falta para tener la dirección exacta. El sistema la necesita siempre (contrato,
 * guía de llegada, agente de IA) aunque el anuncio público sólo muestre la zona.
 */
export function exactAddressProblem(l: AddressParts): string | null {
  const street = (l.addressLine ?? "").trim();
  if (street.length < 4) return "Falta la dirección exacta: calle y número.";
  if (!/\d|s\/?n\b|sin n[uú]mero/i.test(street)) return "A la dirección le falta el número exterior (o «S/N» si no tiene).";
  if (listingNeedsUnit(l) && !(l.addressUnit ?? "").trim() && !l.noAddressUnit) {
    return "Falta el número interior del departamento (o marca que no tiene).";
  }
  return null;
}
