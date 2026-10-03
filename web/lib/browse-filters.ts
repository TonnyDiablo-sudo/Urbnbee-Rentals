/** Filtros de búsqueda (precio, espacio, huéspedes, recámaras, comodidades), a la manera de Airbnb. */

export type SpaceFilter = "completo" | "habitacion";

export type BrowseFilters = {
  min?: number;
  max?: number;
  guests?: number;
  bedrooms?: number;
  space?: SpaceFilter;
  amenities: string[];
  /** Sólo los que se reservan y pagan dentro de Cabibee. */
  bookable: boolean;
};

/** Comodidades que se pueden buscar. Cada una reconoce los nombres con que la escriben los anfitriones. */
export const AMENITY_FILTERS: { key: string; label: string; match: RegExp }[] = [
  { key: "wifi", label: "Wifi", match: /internet|wi-?fi/i },
  { key: "cocina", label: "Cocina", match: /^cocina/i },
  { key: "aire", label: "Aire acondicionado", match: /aire acondicionado/i },
  { key: "calefaccion", label: "Calefacción", match: /calefacci/i },
  { key: "estacionamiento", label: "Estacionamiento", match: /estacionamiento/i },
  { key: "alberca", label: "Alberca", match: /piscina|alberca/i },
  { key: "lavadora", label: "Lavadora", match: /lavadora/i },
  { key: "tv", label: "Televisión", match: /televisi|^tv\b|smart tv/i },
  { key: "terraza", label: "Terraza o balcón", match: /terraza|balc[oó]n/i },
  { key: "jardin", label: "Jardín o patio", match: /jard[ií]n|patio/i },
  { key: "mascotas", label: "Se admiten mascotas", match: /mascota/i },
  { key: "familias", label: "Para familias con niños", match: /famil|niñ/i },
  { key: "chimenea", label: "Chimenea", match: /chimenea/i },
  { key: "desayuno", label: "Desayuno incluido", match: /desayuno/i },
  { key: "trabajo", label: "Área de trabajo", match: /escritorio|trabajo|workspace/i },
];

const AMENITY_KEYS = new Set(AMENITY_FILTERS.map((a) => a.key));

export const EMPTY_FILTERS: BrowseFilters = { amenities: [], bookable: false };

type Raw = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

function positiveInt(v: string | string[] | undefined, cap: number): number | undefined {
  const n = Math.floor(Number(first(v)));
  return Number.isFinite(n) && n > 0 ? Math.min(n, cap) : undefined;
}

export function parseBrowseFilters(raw: Raw): BrowseFilters {
  const space = first(raw.espacio);
  const am = (Array.isArray(raw.am) ? raw.am.join(",") : raw.am ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((k) => AMENITY_KEYS.has(k));
  let min = positiveInt(raw.min, 1_000_000);
  let max = positiveInt(raw.max, 1_000_000);
  if (min && max && min > max) [min, max] = [max, min];
  return {
    min,
    max,
    guests: positiveInt(raw.huespedes, 16),
    bedrooms: positiveInt(raw.recamaras, 10),
    space: space === "completo" || space === "habitacion" ? space : undefined,
    amenities: [...new Set(am)],
    bookable: first(raw.reserva) === "1",
  };
}

/** Escribe los filtros en la URL (sin tocar q, tipo, vista ni verif). */
export function writeBrowseFilters(f: BrowseFilters, p: URLSearchParams): URLSearchParams {
  for (const k of ["min", "max", "huespedes", "recamaras", "espacio", "am", "reserva"]) p.delete(k);
  if (f.min) p.set("min", String(f.min));
  if (f.max) p.set("max", String(f.max));
  if (f.guests) p.set("huespedes", String(f.guests));
  if (f.bedrooms) p.set("recamaras", String(f.bedrooms));
  if (f.space) p.set("espacio", f.space);
  if (f.amenities.length) p.set("am", f.amenities.join(","));
  if (f.bookable) p.set("reserva", "1");
  return p;
}

export function activeFilterCount(f: BrowseFilters): number {
  return (
    (f.min || f.max ? 1 : 0) +
    (f.guests ? 1 : 0) +
    (f.bedrooms ? 1 : 0) +
    (f.space ? 1 : 0) +
    f.amenities.length +
    (f.bookable ? 1 : 0)
  );
}

export type FilterableListing = {
  pricePerNight: number;
  guests: number;
  bedrooms: number;
  spaceType: string;
  amenities: string[];
  bookable: boolean;
};

export function matchesBrowseFilters(l: FilterableListing, f: BrowseFilters): boolean {
  if (f.min && l.pricePerNight < f.min) return false;
  if (f.max && l.pricePerNight > f.max) return false;
  if (f.guests && l.guests < f.guests) return false;
  if (f.bedrooms && l.bedrooms < f.bedrooms) return false;
  if (f.space === "habitacion" && !/habitaci/i.test(l.spaceType)) return false;
  if (f.space === "completo" && /habitaci|compartid/i.test(l.spaceType)) return false;
  if (f.bookable && !l.bookable) return false;
  for (const key of f.amenities) {
    const a = AMENITY_FILTERS.find((x) => x.key === key);
    if (a && !l.amenities.some((name) => a.match.test(name.trim()))) return false;
  }
  return true;
}
