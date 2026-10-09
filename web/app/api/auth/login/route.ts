import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { rememberAssociatePassword } from "@/lib/associate-password-vault";
import { emailFromLoginName } from "@/lib/associate-provision";
import { isAccountSuspended } from "@/lib/account-standing";
import { findUserByEmail } from "@/lib/marketplace-store";
import { isStaffAccount } from "@/lib/staff";
import { createSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = emailFromLoginName(String(body.email ?? ""));
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Escribe tu correo o usuario y tu contraseña." }, { status: 400 });
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
      staff: isStaffAccount(user),
      suspended: isAccountSuspended(user),
    },
  });
}
