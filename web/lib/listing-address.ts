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

export type StreetParts = { street: string; number: string; postalCode: string };

const NO_NUMBER = /^(s\s*\/\s*n|sin\s+n[uú]mero)$/i;
const CP = /,?\s*\b(?:c\.?\s*p\.?|c[oó]digo\s+postal|zip)\s*:?\s*(\d{4,5})\b/i;
const TRAILING_NUMBER =
  /^(.*?)[\s,]+(?:#\s*|no\.\s*|n[uú]m\.?\s*|n[uú]mero\s+)?(\d+\s?[a-z]?(?:\s?-\s?\d+[a-z]?)?|s\s*\/\s*n|sin\s+n[uú]mero)$/i;

/** Separa «Colima 123, CP 06700» en calle, número exterior y código postal para editarlos por separado. */
export function splitStreet(line: string | undefined): StreetParts {
  let rest = (line ?? "").trim();
  let postalCode = "";
  const cp = CP.exec(rest);
  if (cp) {
    postalCode = cp[1];
    rest = (rest.slice(0, cp.index) + rest.slice(cp.index + cp[0].length)).trim();
  } else {
    const tail = /,\s*(\d{5})\s*$/.exec(rest);
    if (tail) {
      postalCode = tail[1];
      rest = rest.slice(0, tail.index).trim();
    }
  }
  rest = rest.replace(/[,\s]+$/, "");
  const m = TRAILING_NUMBER.exec(rest);
  if (m && m[1].trim()) return { street: m[1].trim().replace(/,$/, ""), number: m[2].replace(/\s+/g, ""), postalCode };
  return { street: rest, number: "", postalCode };
}

export function joinStreet(p: StreetParts): string {
  const number = NO_NUMBER.test(p.number.trim()) ? "S/N" : p.number.trim();
  const main = [p.street.trim(), number].filter(Boolean).join(" ");
  const cp = p.postalCode.trim();
  return cp ? `${main}${main ? ", " : ""}CP ${cp}` : main;
}

/**
 * Qué falta para tener la dirección exacta. El sistema la necesita siempre (contrato,
 * guía de llegada, agente de IA) aunque el anuncio público sólo muestre la zona.
 */
export function exactAddressProblem(l: AddressParts): string | null {
  const street = (l.addressLine ?? "").replace(CP, "").trim();
  if (!/\p{L}{2,}/u.test(street.replace(/s\s*\/\s*n|sin\s+n[uú]mero/gi, ""))) return "Falta el nombre de la calle.";
  if (!/\d|s\s*\/\s*n\b|sin n[uú]mero/i.test(street)) return "A la dirección le falta el número exterior (o «S/N» si no tiene).";
  if (listingNeedsUnit(l) && !(l.addressUnit ?? "").trim() && !l.noAddressUnit) {
    return "Falta el número interior del departamento (o marca que no tiene).";
  }
  return null;
}
