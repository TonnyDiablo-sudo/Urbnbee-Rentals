import { NextRequest, NextResponse } from "next/server";
import { appBrowseListings } from "@/lib/app-listings";
import { parseBrowseFilters } from "@/lib/browse-filters";

/** Cuántos alojamientos quedan con esos filtros (para el botón «Mostrar N»). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const raw = Object.fromEntries(sp.entries());
  const count = appBrowseListings({
    tipo: sp.get("tipo") ?? "",
    q: sp.get("q") ?? "",
    verifiedOnly: sp.get("verif") === "1",
    filters: parseBrowseFilters(raw),
  }).length;
  return NextResponse.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
