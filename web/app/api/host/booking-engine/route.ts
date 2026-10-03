import { NextRequest, NextResponse } from "next/server";
import { engineSummary, setListingEngine } from "@/lib/booking-engine-slots";
import { getSessionUser } from "@/lib/session";

async function hostOnly() {
  const user = await getSessionUser();
  return user && (user.role === "host" || user.role === "admin") ? user : null;
}

/** Cuántos lugares del motor tiene el anfitrión y qué anuncios los usan. */
export async function GET() {
  const user = await hostOnly();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json(engineSummary(user.id));
}

export async function PATCH(req: NextRequest) {
  const user = await hostOnly();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { listingId?: string; on?: boolean };
  if (typeof body.listingId !== "string" || typeof body.on !== "boolean") {
    return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  }
  const r = setListingEngine(user.id, body.listingId, body.on);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
  return NextResponse.json(engineSummary(user.id));
}
