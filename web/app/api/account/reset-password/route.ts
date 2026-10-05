import { NextRequest, NextResponse } from "next/server";
import { consumePasswordReset, requestPasswordReset } from "@/lib/password-reset";
import { publicOriginFromRequest } from "@/lib/public-origin";

/** Pedir el enlace. Siempre responde igual para no revelar si el correo existe. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  await requestPasswordReset(String(body.email ?? ""), publicOriginFromRequest(req));
  return NextResponse.json({
    ok: true,
    message: "Si esa cuenta existe y tiene un correo real, te mandamos el enlace. Revisa también el spam.",
  });
}

/** Consumir el token y poner la contraseña nueva. */
export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { token?: string; password?: string };
  const result = await consumePasswordReset(String(body.token ?? ""), String(body.password ?? ""));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
