import { NextRequest, NextResponse } from "next/server";
import { CREDIT_CHECK_ENABLED } from "@/lib/feature-flags";
import { runScreeningCheckout } from "@/lib/screening-checkout";
import { getScreeningById } from "@/lib/screening-store";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!CREDIT_CHECK_ENABLED) {
    return NextResponse.json({ error: "La revisión de historial crediticio todavía no está disponible." }, { status: 403 });
  }
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const row = getScreeningById(id);
  if (!row || row.guestUserId !== user.id) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  return runScreeningCheckout(req, {
    screening: row,
    payerUser: user,
    expectedPayer: "guest",
    successPath: "/guest/screening?paid=1",
    cancelPath: "/guest/screening",
  });
}
