import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { rememberAssociatePassword } from "@/lib/associate-password-vault";
import { findUserByEmail } from "@/lib/marketplace-store";
import { createSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Correo y contraseña son obligatorios." }, { status: 400 });
  }

  const user = findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "Credenciales incorrectas." }, { status: 401 });
  }

  await createSession({ id: user.id, email: user.email, role: user.role });
  if (user.associate) rememberAssociatePassword(user.id, password);

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      mustChangePassword: Boolean(user.mustChangePassword),
      associate: Boolean(user.associate),
    },
  });
}
