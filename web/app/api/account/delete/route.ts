import { NextRequest, NextResponse } from "next/server";
import { eraseAccount } from "@/lib/account-erase";
import { clearSession, getSessionUser } from "@/lib/session";

/** Borra la cuenta, los anuncios y los datos personales. Hay que escribir el correo para confirmar. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (user.role === "admin") {
    return NextResponse.json({ error: "Una cuenta de administración no se puede borrar aquí." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { confirmEmail?: unknown };
  const typed = typeof body.confirmEmail === "string" ? body.confirmEmail.trim().toLowerCase() : "";
  if (!typed || typed !== user.email.trim().toLowerCase()) {
    return NextResponse.json({ error: "Escribe tu correo tal como aparece en la cuenta." }, { status: 400 });
  }
  const ok = eraseAccount(user.id);
  if (!ok) return NextResponse.json({ error: "No se pudo borrar la cuenta." }, { status: 400 });
  await clearSession();
  return NextResponse.json({ ok: true });
}
