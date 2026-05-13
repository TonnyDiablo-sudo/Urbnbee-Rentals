import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createUser, findUserByEmail } from "@/lib/marketplace-store";
import { createSession } from "@/lib/session";
import type { UserRole } from "@/lib/marketplace-types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    const fullName = String(body.fullName ?? "").trim();
    const phone = body.phone ? String(body.phone).trim() : undefined;
    const intent = body.intent === "host" ? "host" : "guest";

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Completa correo, nombre y contraseña." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
    }
    if (findUserByEmail(email)) {
      return NextResponse.json({ error: "Este correo ya está registrado." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 11);
    const role: UserRole = intent === "host" ? "host" : "guest";
    const user = createUser({
      email,
      passwordHash,
      fullName,
      phone,
      role,
    });

    await createSession({ id: user.id, email: user.email, role: user.role });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
    });
  } catch (e) {
    const msg = e instanceof Error && e.message === "EMAIL_IN_USE" ? "Este correo ya está registrado." : "Error al registrar.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
