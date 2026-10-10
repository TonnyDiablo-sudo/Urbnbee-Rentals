import { NextRequest, NextResponse } from "next/server";
import { bureauFormUrlFor } from "@/lib/screening-bureau";
import { screeningBlocked } from "@/lib/screening-guard";
import { getScreeningById } from "@/lib/screening-store";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  const blocked = screeningBlocked(req, user);
  if (blocked) return blocked;
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const row = getScreeningById(id);
  if (!row || row.guestUserId !== user.id) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  const url = bureauFormUrlFor(row);
  if (!url) {
    return NextResponse.json({ error: "Esta consulta ya no necesita tu NIP." }, { status: 409 });
  }
  return NextResponse.json({ checkoutUrl: url }, { headers: { "Cache-Control": "no-store" } });
}
