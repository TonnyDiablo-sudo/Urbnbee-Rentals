/** Ubicación normalizada para filtrar métricas: país, estado y ciudad en español. */
export type GeoPlace = { country: string; state: string; city: string };

export const UNKNOWN = "Sin dato";

export const MX_STATES: Record<string, string> = {
  AGU: "Aguascalientes",
  BCN: "Baja California",
  BCS: "Baja California Sur",
  CAM: "Campeche",
  CHP: "Chiapas",
  CHH: "Chihuahua",
  CMX: "Ciudad de México",
  DIF: "Ciudad de México",
  COA: "Coahuila",
  COL: "Colima",
  DUR: "Durango",
  GUA: "Guanajuato",
  GRO: "Guerrero",
  HID: "Hidalgo",
  JAL: "Jalisco",
  MEX: "Estado de México",
  MIC: "Michoacán",
  MOR: "Morelos",
  NAY: "Nayarit",
  NLE: "Nuevo León",
  OAX: "Oaxaca",
  PUE: "Puebla",
  QUE: "Querétaro",
  ROO: "Quintana Roo",
  SLP: "San Luis Potosí",
  SIN: "Sinaloa",
  SON: "Sonora",
  TAB: "Tabasco",
  TAM: "Tamaulipas",
  TLA: "Tlaxcala",
  VER: "Veracruz",
  YUC: "Yucatán",
  ZAC: "Zacatecas",
};

const countryNames = new Intl.DisplayNames(["es"], { type: "region" });

export function countryNameFromCode(code: string | undefined): string {
  const c = code?.trim().toUpperCase();
  if (!c || c.length !== 2) return UNKNOWN;
  try {
    return countryNames.of(c) ?? c;
  } catch {
    return c;
  }
}

/** [nombre, estado, lat, lng]: capitales y destinos frecuentes. Sirve para ubicar anuncios sin estado guardado. */
const MX_PLACES: [string, string, number, number][] = [
  ["Ciudad de México", "Ciudad de México", 19.4326, -99.1332],
  ["Guadalajara", "Jalisco", 20.6597, -103.3496],
  ["Zapopan", "Jalisco", 20.7214, -103.3918],
  ["Tlaquepaque", "Jalisco", 20.6409, -103.2934],
  ["Puerto Vallarta", "Jalisco", 20.6534, -105.2253],
  ["Mazamitla", "Jalisco", 19.9155, -103.0197],
  ["Tapalpa", "Jalisco", 19.9447, -103.7586],
  ["Chapala", "Jalisco", 20.2967, -103.1906],
  ["Ajijic", "Jalisco", 20.2996, -103.2632],
  ["Tequila", "Jalisco", 20.8826, -103.8366],
  ["Monterrey", "Nuevo León", 25.6866, -100.3161],
  ["San Pedro Garza García", "Nuevo León", 25.6573, -100.4026],
  ["Cancún", "Quintana Roo", 21.1619, -86.8515],
  ["Playa del Carmen", "Quintana Roo", 20.6296, -87.0739],
  ["Tulum", "Quintana Roo", 20.2114, -87.4654],
  ["Bacalar", "Quintana Roo", 18.6772, -88.3953],
  ["Cozumel", "Quintana Roo", 20.4230, -86.9223],
  ["Chetumal", "Quintana Roo", 18.5001, -88.2961],
  ["Mérida", "Yucatán", 20.9674, -89.5926],
  ["Valladolid", "Yucatán", 20.6896, -88.2011],
  ["Oaxaca", "Oaxaca", 17.0732, -96.7266],
  ["Huatulco", "Oaxaca", 15.7700, -96.1300],
  ["Puerto Escondido", "Oaxaca", 15.8720, -97.0767],
  ["San Miguel de Allende", "Guanajuato", 20.9144, -100.7452],
  ["Guanajuato", "Guanajuato", 21.0190, -101.2574],
  ["León", "Guanajuato", 21.1250, -101.6860],
  ["Querétaro", "Querétaro", 20.5888, -100.3899],
  ["Tequisquiapan", "Querétaro", 20.5214, -99.8917],
  ["Peña de Bernal", "Querétaro", 20.7414, -99.9417],
  ["Ensenada", "Baja California", 31.8667, -116.5964],
  ["Valle de Guadalupe", "Baja California", 32.0906, -116.5717],
  ["Tijuana", "Baja California", 32.5149, -117.0382],
  ["Mexicali", "Baja California", 32.6245, -115.4523],
  ["Rosarito", "Baja California", 32.3610, -117.0577],
  ["Los Cabos", "Baja California Sur", 22.8905, -109.9167],
  ["Cabo San Lucas", "Baja California Sur", 22.8905, -109.9167],
  ["San José del Cabo", "Baja California Sur", 23.0631, -109.7028],
  ["La Paz", "Baja California Sur", 24.1426, -110.3128],
  ["Todos Santos", "Baja California Sur", 23.4464, -110.2265],
  ["Mazatlán", "Sinaloa", 23.2494, -106.4111],
  ["Culiacán", "Sinaloa", 24.8091, -107.3940],
  ["Valle de Bravo", "Estado de México", 19.1950, -100.1311],
  ["Toluca", "Estado de México", 19.2826, -99.6557],
  ["Malinalco", "Estado de México", 18.9486, -99.4945],
  ["Puebla", "Puebla", 19.0414, -98.2063],
  ["Cholula", "Puebla", 19.0633, -98.3060],
  ["Cuetzalan", "Puebla", 20.0186, -97.5225],
  ["Cuernavaca", "Morelos", 18.9242, -99.2216],
  ["Tepoztlán", "Morelos", 18.9847, -99.0931],
  ["Acapulco", "Guerrero", 16.8531, -99.8237],
  ["Zihuatanejo", "Guerrero", 17.6417, -101.5519],
  ["Taxco", "Guerrero", 18.5564, -99.6050],
  ["Sayulita", "Nayarit", 20.8689, -105.4408],
  ["Bucerías", "Nayarit", 20.7564, -105.3347],
  ["Nuevo Vallarta", "Nayarit", 20.6989, -105.2969],
  ["Tepic", "Nayarit", 21.5042, -104.8946],
  ["San Cristóbal de las Casas", "Chiapas", 16.7370, -92.6376],
  ["Tuxtla Gutiérrez", "Chiapas", 16.7516, -93.1029],
  ["Palenque", "Chiapas", 17.5092, -91.9822],
  ["Campeche", "Campeche", 19.8301, -90.5349],
  ["Veracruz", "Veracruz", 19.1738, -96.1342],
  ["Xalapa", "Veracruz", 19.5438, -96.9102],
  ["Morelia", "Michoacán", 19.7060, -101.1950],
  ["Pátzcuaro", "Michoacán", 19.5130, -101.6090],
  ["Aguascalientes", "Aguascalientes", 21.8853, -102.2916],
  ["San Luis Potosí", "San Luis Potosí", 22.1565, -100.9855],
  ["Real de Catorce", "San Luis Potosí", 23.6889, -100.8869],
  ["Xilitla", "San Luis Potosí", 21.3864, -98.9897],
  ["Zacatecas", "Zacatecas", 22.7709, -102.5832],
  ["Durango", "Durango", 24.0277, -104.6532],
  ["Chihuahua", "Chihuahua", 28.6320, -106.0691],
  ["Creel", "Chihuahua", 27.7522, -107.6347],
  ["Ciudad Juárez", "Chihuahua", 31.6904, -106.4245],
  ["Hermosillo", "Sonora", 29.0729, -110.9559],
  ["San Carlos", "Sonora", 27.9606, -111.0436],
  ["Puerto Peñasco", "Sonora", 31.3172, -113.5370],
  ["Saltillo", "Coahuila", 25.4232, -101.0053],
  ["Torreón", "Coahuila", 25.5428, -103.4068],
  ["Tampico", "Tamaulipas", 22.2331, -97.8611],
  ["Ciudad Victoria", "Tamaulipas", 23.7369, -99.1411],
  ["Villahermosa", "Tabasco", 17.9892, -92.9475],
  ["Pachuca", "Hidalgo", 20.1011, -98.7591],
  ["Huasca de Ocampo", "Hidalgo", 20.2036, -98.5756],
  ["Tlaxcala", "Tlaxcala", 19.3182, -98.2375],
  ["Colima", "Colima", 19.2452, -103.7241],
  ["Manzanillo", "Colima", 19.1138, -104.3385],
];

const CITY_ALIASES: Record<string, string> = {
  cdmx: "Ciudad de México",
  "ciudad de mexico": "Ciudad de México",
  "mexico city": "Ciudad de México",
  df: "Ciudad de México",
  gdl: "Guadalajara",
  mty: "Monterrey",
  cabo: "Los Cabos",
  "cabo san lucas": "Los Cabos",
};

function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const byName = new Map(MX_PLACES.map((p) => [norm(p[0]), p]));

export function normalizeCity(city: string | undefined): string {
  const c = city?.trim();
  if (!c) return UNKNOWN;
  return CITY_ALIASES[norm(c)] ?? c;
}

function nearestMxState(lat: number, lng: number): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const [, state, plat, plng] of MX_PLACES) {
    const d = (plat - lat) ** 2 + ((plng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bestD) {
      bestD = d;
      best = state;
    }
  }
  return bestD < 1.5 ** 2 ? best : null;
}

const MX_STATE_NAMES = new Map(
  [...Object.values(MX_STATES), "CDMX", "Edomex", "Estado de Mexico", "Mexico"].map((s) => [
    norm(s),
    s === "CDMX" ? "Ciudad de México" : /^(edomex|estado de mexico|mexico)$/i.test(norm(s)) ? "Estado de México" : s,
  ])
);

export const COUNTRY_OPTIONS = [
  "México",
  "Estados Unidos",
  "Canadá",
  "Guatemala",
  "Belice",
  "Costa Rica",
  "Panamá",
  "Colombia",
  "Perú",
  "Chile",
  "Argentina",
  "España",
];

export function isMexico(country: string | undefined): boolean {
  return !country?.trim() || norm(country) === "mexico";
}

export const MX_STATE_LIST = [...new Set(Object.values(MX_STATES))].sort((a, b) => a.localeCompare(b, "es"));

type ListingGeoInput = {
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  lat?: number | null;
  lng?: number | null;
};

/**
 * Estado de un anuncio sin `state` guardado. En México: el municipio si ya es un estado
 * (el editor viejo lo guardaba ahí), la ciudad o municipio conocidos, o la ciudad conocida más cercana.
 * Fuera de México, `county` hacía las veces de estado.
 */
export function inferListingState(l: ListingGeoInput): string {
  const country = l.country?.trim() || "México";
  if (norm(country) !== "mexico") return l.county?.trim() ?? "";
  const county = l.county ? norm(l.county) : "";
  if (county && county !== "mexico" && MX_STATE_NAMES.has(county)) return MX_STATE_NAMES.get(county)!;
  const hit = byName.get(norm(normalizeCity(l.city))) ?? (county ? byName.get(county) : undefined);
  if (hit) return hit[1];
  if (typeof l.lat === "number" && typeof l.lng === "number" && (l.lat || l.lng)) return nearestMxState(l.lat, l.lng) ?? "";
  return "";
}

export function placeForListing(l: ListingGeoInput): GeoPlace {
  const country = l.country?.trim() || "México";
  const city = normalizeCity(l.city);
  const state = l.state?.trim() || inferListingState(l) || UNKNOWN;
  return { country, state, city };
}

export function placeKey(p: GeoPlace): string {
  return `${p.country}|${p.state}|${p.city}`;
}

export function parsePlaceKey(k: string): GeoPlace {
  const [country = UNKNOWN, state = UNKNOWN, city = UNKNOWN] = k.split("|");
  return { country, state, city };
}
