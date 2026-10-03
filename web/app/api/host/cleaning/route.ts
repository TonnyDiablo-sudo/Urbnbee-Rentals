import { NextRequest, NextResponse } from "next/server";
import { addManualCleaning, hostCleaningView, setListingCleaning, updateCleaningSettings } from "@/lib/cleaning-service";
import { getSessionUser } from "@/lib/session";

async function hostOnly() {
  const user = await getSessionUser();
  return user && (user.role === "host" || user.role === "admin") ? user : null;
}

export async function GET() {
  const user = await hostOnly();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json(hostCleaningView(user.id));
}

/** Limpieza extra que no viene de una reserva. */
export async function POST(req: NextRequest) {
  const user = await hostOnly();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = addManualCleaning(user.id, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(hostCleaningView(user.id));
}

/** Agregar o quitar un anuncio de la herramienta, o elegir quién lo limpia por defecto. */
export async function PATCH(req: NextRequest) {
  const user = await hostOnly();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    listingId?: string;
    on?: boolean;
    cleaner?: string | null;
    settings?: Record<string, unknown>;
  };
  if (body.settings && typeof body.settings === "object") {
    const r = updateCleaningSettings(user.id, body.settings);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json(hostCleaningView(user.id));
  }
  if (typeof body.listingId !== "string") return NextResponse.json({ error: "Falta el anuncio." }, { status: 400 });
  const r = setListingCleaning(user.id, body.listingId, {
    on: typeof body.on === "boolean" ? body.on : undefined,
    cleaner: body.cleaner === null || typeof body.cleaner === "string" ? body.cleaner : undefined,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(hostCleaningView(user.id));
}
