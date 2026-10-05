import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { createSupply, suppliesView } from "@/lib/supplies-service";

export const dynamic = "force-dynamic";

/** Insumos de un anfitrión: `?host=` (por defecto, el propio). */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const v = suppliesView(user.id, req.nextUrl.searchParams.get("host") || user.id);
  if (!v) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  return NextResponse.json(v);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const hostId = typeof body.host === "string" && body.host ? body.host : user.id;
  const r = createSupply(user.id, hostId, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(suppliesView(user.id, hostId));
}
