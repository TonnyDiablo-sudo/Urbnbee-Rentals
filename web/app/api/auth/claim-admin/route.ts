import { NextResponse } from "next/server";
import { createSession, getSessionUser } from "@/lib/session";
import { findUserByEmail, setUserRole } from "@/lib/marketplace-store";

/**
 * Promueve a admin al usuario en sesión si su correo coincide con URBNBEE_ADMIN_EMAIL.
 * Útil en Railway sin Shell: define la variable, redeploy, entra y visita POST o GET una vez.
 */
export async function POST() {
  const allow = process.env.URBNBEE_ADMIN_EMAIL?.trim().toLowerCase();
  if (!allow) {
    return NextResponse.json(
      { error: "URBNBEE_ADMIN_EMAIL no está definida en el servidor." },
      { status: 503 }
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  if (user.email !== allow) {
    return NextResponse.json(
      { error: "Este correo no coincide con URBNBEE_ADMIN_EMAIL del servidor." },
      { status: 403 }
    );
  }

  if (user.role !== "admin") {
    setUserRole(user.id, "admin");
  }

  const updated = findUserByEmail(user.email);
  if (!updated) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 500 });
  }

  await createSession({ id: updated.id, email: updated.email, role: updated.role });

  return NextResponse.json({
    ok: true,
    role: updated.role,
    redirect: "/admin/overview",
  });
}
