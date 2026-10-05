import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { isPlaceholderEmail } from "@/lib/associate-provision";
import { sendVerificationEmail } from "@/lib/email-verification";
import { getLang } from "@/lib/i18n/server";
import { createUser, findUserByEmail, updateUserAuth } from "@/lib/marketplace-store";
import { normalizeLegitPhone } from "@/lib/phone-validation";
import { publicOriginFromRequest } from "@/lib/public-origin";
import { createSession } from "@/lib/session";
import type { UserRole } from "@/lib/marketplace-types";
import { TERMS_VERSION } from "@/lib/terms";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    const fullName = String(body.fullName ?? "").trim();
    const phone = normalizeLegitPhone(body.phone) ?? undefined;
    const intent = body.intent === "host" ? "host" : "guest";

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Completa correo, nombre y contraseña." }, { status: 400 });
    }
    if (body.acceptTerms !== true) {
      return NextResponse.json({ error: "Debes aceptar los Términos y condiciones de uso." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
    }
    if (isPlaceholderEmail(email)) {
      return NextResponse.json({ error: "Escribe un correo válido." }, { status: 400 });
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
    updateUserAuth(user.id, {
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: new Date().toISOString(),
      lang: await getLang(),
    });

    await createSession({ id: user.id, email: user.email, role: user.role });
    void sendVerificationEmail(user.id, publicOriginFromRequest(req));

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
    });
  } catch (e) {
    const msg = e instanceof Error && e.message === "EMAIL_IN_USE" ? "Este correo ya está registrado." : "Error al registrar.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
