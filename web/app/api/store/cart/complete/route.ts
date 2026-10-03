import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { STORE_CART_KIND, fulfillCartSession } from "@/lib/store-cart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Al regresar de Stripe: cobra y activa lo del carrito (el webhook hace lo mismo por si el navegador no regresa). */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { sessionId?: unknown };
  const sessionId = typeof body.sessionId === "string" && /^cs_[A-Za-z0-9_]+$/.test(body.sessionId) ? body.sessionId : "";
  if (!sessionId) return NextResponse.json({ error: "Falta la sesión de pago." }, { status: 400 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe no configurado." }, { status: 503 });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.kind !== STORE_CART_KIND || session.metadata?.userId !== user.id) {
      return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    }
    const result = await fulfillCartSession(stripe, sessionId);
    return NextResponse.json(result, { status: result.lines.length ? 200 : 409 });
  } catch (e) {
    console.warn("[store cart] complete", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No pudimos confirmar el pago. Recarga en un momento." }, { status: 502 });
  }
}
