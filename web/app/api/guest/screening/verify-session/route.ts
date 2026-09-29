import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { screeningPublicView, settleScreeningCheckoutSession } from "@/lib/screening-service";
import { getStripe } from "@/lib/stripe-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Sesión inválida." }, { status: 400 });
  }
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe no configurado." }, { status: 503 });
  }
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (e) {
    console.warn("[screening verify-session]", e);
    return NextResponse.json({ error: "No se pudo verificar el pago." }, { status: 502 });
  }
  const settled = settleScreeningCheckoutSession(session);
  if (!settled.ok) {
    return NextResponse.json({ error: settled.error }, { status: settled.status });
  }
  const owns =
    settled.screening.guestUserId === user.id || settled.screening.hostId === user.id;
  if (!owns) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  return NextResponse.json({ ok: true, screening: screeningPublicView(settled.screening) });
}
