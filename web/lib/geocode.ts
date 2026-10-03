import "server-only";

/** Nominatim (OpenStreetMap). Devuelve null si no encuentra nada o el servicio falla. */
export async function geocodePlace(q: string): Promise<{ lat: number; lng: number } | null> {
  const query = q.trim();
  if (query.length < 3) return null;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "CabibeeAssociates/1.0 (https://cabibee.com geocoding)",
        "Accept-Language": "es,en",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { lat: string; lon: string }[];
    const lat = parseFloat(rows?.[0]?.lat ?? "");
    const lng = parseFloat(rows?.[0]?.lon ?? "");
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}
