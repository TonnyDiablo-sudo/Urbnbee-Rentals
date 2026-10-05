import { NextRequest, NextResponse } from "next/server";
import { featuredDemand } from "@/lib/featured-demand";
import { featuredSummary, setListingFeatured } from "@/lib/featured-slots";
import { getSessionUser } from "@/lib/session";

async function hostOnly() {
  const user = await getSessionUser();
  return user && (user.role === "host" || user.role === "admin") ? user : null;
}

/** Cuántos lugares de «Anuncio destacado» tiene el anfitrión y qué anuncios los usan. */
export async function GET() {
  const user = await hostOnly();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json(summaryWithDemand(user.id));
}

function summaryWithDemand(hostId: string) {
  const d = featuredDemand();
  return { ...featuredSummary(hostId), demand: { occupancy: d.occupancy, multiplier: d.multiplier, soldOut: d.soldOut, slotsLeft: d.slotsLeft } };
}

export async function PATCH(req: NextRequest) {
  const user = await hostOnly();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { listingId?: string; on?: boolean };
  if (typeof body.listingId !== "string" || typeof body.on !== "boolean") {
    return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  }
  const r = setListingFeatured(user.id, body.listingId, body.on);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
  return NextResponse.json(summaryWithDemand(user.id));
}
