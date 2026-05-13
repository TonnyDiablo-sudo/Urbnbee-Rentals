import { NextResponse } from "next/server";
import { setUserRole } from "@/lib/marketplace-store";
import { createSession, getSessionUser } from "@/lib/session";

/** Huésped → anfitrión (misma cuenta, sin volver a registrarse). */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Inicia sesión primero." }, { status: 401 });
  }
  if (user.role === "host" || user.role === "admin") {
    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
    });
  }
  if (user.role !== "guest") {
    return NextResponse.json({ error: "No aplicable." }, { status: 400 });
  }

  const next = setUserRole(user.id, "host");
  if (!next) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  await createSession({ id: next.id, email: next.email, role: next.role });

  return NextResponse.json({
    ok: true,
    user: { id: next.id, email: next.email, role: next.role, fullName: next.fullName },
  });
}
