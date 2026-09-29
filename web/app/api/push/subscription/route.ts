import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { pushConfigured, pushPublicKey } from "@/lib/push";
import { hasSubscription, removeSubscription, saveSubscription } from "@/lib/push-store";

function validEndpoint(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 1000) return null;
  try {
    return new URL(raw).protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

function key(raw: unknown): string | null {
  return typeof raw === "string" && /^[A-Za-z0-9_-]{8,200}={0,2}$/.test(raw) ? raw : null;
}

/** `?endpoint=` dice si este dispositivo ya está suscrito para la cuenta actual. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  const configured = pushConfigured();
  const endpoint = validEndpoint(req.nextUrl.searchParams.get("endpoint"));
  return NextResponse.json({
    configured,
    publicKey: configured ? pushPublicKey() : null,
    subscribed: Boolean(user && endpoint && hasSubscription(user.id, endpoint)),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  if (!pushConfigured()) {
    return NextResponse.json({ error: "Las notificaciones no están activadas en el servidor." }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const endpoint = validEndpoint(body?.endpoint);
  const p256dh = key(body?.keys?.p256dh);
  const auth = key(body?.keys?.auth);
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Suscripción inválida." }, { status: 400 });
  }
  saveSubscription({
    userId: user.id,
    endpoint,
    keys: { p256dh, auth },
    userAgent: req.headers.get("user-agent")?.slice(0, 200) || undefined,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const endpoint = validEndpoint(body?.endpoint);
  if (endpoint) removeSubscription(endpoint, user.id);
  return NextResponse.json({ ok: true });
}
