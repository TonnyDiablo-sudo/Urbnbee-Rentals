import { NextRequest, NextResponse } from "next/server";
import { consumeVerificationToken, sendVerificationEmail } from "@/lib/email-verification";
import { publicOriginFromRequest } from "@/lib/public-origin";
import { getSessionUser } from "@/lib/session";

/** Enlace del correo de confirmación. */
export async function GET(req: NextRequest) {
  const ok = consumeVerificationToken(req.nextUrl.searchParams.get("token") ?? "");
  const origin = publicOriginFromRequest(req).replace(/:\/\/app\./i, "://");
  return NextResponse.redirect(`${origin}/correo-verificado?ok=${ok ? "1" : "0"}`);
}

/** Reenviar el correo de confirmación. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (user.emailVerifiedAt && !user.pendingEmail) return NextResponse.json({ ok: true, alreadyVerified: true });
  if (user.placeholderEmail && !user.pendingEmail) {
    return NextResponse.json({ error: "Primero pon tu correo personal." }, { status: 400 });
  }
  const sent = await sendVerificationEmail(user.id, publicOriginFromRequest(req));
  return NextResponse.json({ ok: true, sent });
}
