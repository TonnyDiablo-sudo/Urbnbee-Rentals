import { NextRequest, NextResponse } from "next/server";

/**
 * Geocodificación vía Nominatim (OpenStreetMap). Requiere User-Agent identificable.
 * Uso: /api/geocode?q=calle%20...,zona,ciudad,país
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json(
      { error: "Escribe al menos la dirección o la ciudad para buscar en el mapa." },
      { status: 400 }
    );
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "UrbnbeeHostEditor/1.0 (https://urbnbee.com — dev geocoding)",
        "Accept-Language": "es,en",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "El servicio de mapas no respondió. Intenta de nuevo." }, { status: 502 });
    }

    const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No encontramos esa dirección. Revisa calle, colonia y ciudad, o ajusta lat/lng a mano." },
        { status: 404 }
      );
    }

    const r = rows[0];
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: "Coordenadas inválidas en la respuesta." }, { status: 502 });
    }

    return NextResponse.json({
      lat,
      lng,
      displayName: r.display_name,
    });
  } catch (e) {
    console.error("[geocode]", e);
    return NextResponse.json({ error: "Error al geocodificar." }, { status: 500 });
  }
}
