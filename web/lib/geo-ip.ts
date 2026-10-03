import "server-only";
import { countryNameFromCode, MX_STATES, normalizeCity, UNKNOWN, type GeoPlace } from "@/lib/geo-places";

type GeoipModule = { lookup(ip: string): { country: string; region: string; city: string } | null };
let geoip: GeoipModule | null | undefined;

/** Base GeoLite local (geoip-lite): sin llamadas externas ni límites. Se carga la primera vez que se usa. */
async function loadGeoip(): Promise<GeoipModule | null> {
  if (geoip !== undefined) return geoip;
  try {
    const mod = (await import("geoip-lite")) as unknown as { default?: GeoipModule } & GeoipModule;
    geoip = mod.default ?? mod;
  } catch (e) {
    console.warn("[geo-ip] geoip-lite no disponible:", e);
    geoip = null;
  }
  return geoip;
}

export async function placeFromIp(ip: string | null | undefined): Promise<GeoPlace> {
  const unknown = { country: UNKNOWN, state: UNKNOWN, city: UNKNOWN };
  if (!ip) return unknown;
  const g = await loadGeoip();
  const hit = g?.lookup(ip.replace(/^::ffff:/, ""));
  if (!hit?.country) return unknown;
  const state = hit.country === "MX" ? (MX_STATES[hit.region] ?? UNKNOWN) : hit.region || UNKNOWN;
  return { country: countryNameFromCode(hit.country), state, city: hit.city ? normalizeCity(hit.city) : UNKNOWN };
}
