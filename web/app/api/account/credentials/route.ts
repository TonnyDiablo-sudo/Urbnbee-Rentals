import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { notifyEmailChanged, notifyPasswordChanged } from "@/lib/account-notices";
import { isPlaceholderEmail } from "@/lib/associate-provision";
import { userLang } from "@/lib/email";
import { sendVerificationEmail } from "@/lib/email-verification";
import { getHostProfile, updateUserAuth, upsertHostProfile } from "@/lib/marketplace-store";
import { normalizeLegitPhone, PHONE_ERROR } from "@/lib/phone-validation";
import { publicOriginFromRequest } from "@/lib/public-origin";
import { createSession, getSessionUser } from "@/lib/session";

/**
 * Cambia correo y/o contraseña. Si la cuenta trae contraseña temporal (creada por un
 * asociado), no pide la actual: acaba de entrar con ella.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const email = String(body.email ?? user.email).trim().toLowerCase();
  const newPassword = String(body.newPassword ?? "");
  const currentPassword = String(body.currentPassword ?? "");
  const emailChanged = email !== user.email;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Escribe un correo válido." }, { status: 400 });
  }
  if (isPlaceholderEmail(email)) {
    return NextResponse.json({ error: "Pon tu correo personal, no el usuario temporal." }, { status: 400 });
  }
  const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
  const phone = rawPhone ? normalizeLegitPhone(rawPhone) : null;
  if ((user.mustChangePassword && !phone) || (rawPhone && !phone)) {
    return NextResponse.json({ error: PHONE_ERROR }, { status: 400 });
  }
  if (user.mustChangePassword && newPassword.length < 8) {
    return NextResponse.json({ error: "Crea una contraseña nueva de al menos 8 caracteres." }, { status: 400 });
  }
  if (newPassword && newPassword.length < 8) {
    return NextResponse.json({ error: "La contraseña nueva debe tener al menos 8 caracteres." }, { status: 400 });
  }
  if (!user.mustChangePassword && (emailChanged || newPassword)) {
    if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: "Tu contraseña actual no es correcta." }, { status: 401 });
    }
  }
  if (newPassword && (await bcrypt.compare(newPassword, user.passwordHash))) {
    return NextResponse.json({ error: "La contraseña nueva debe ser distinta a la temporal." }, { status: 400 });
  }

  let updated;
  try {
    updated = updateUserAuth(user.id, {
      ...(emailChanged
        ? {
            email,
            placeholderEmail: undefined,
            emailVerifiedAt: undefined,
            emailVerifyTokenHash: undefined,
            emailVerifyExpiresAt: undefined,
            passwordResetTokenHash: undefined,
            passwordResetExpiresAt: undefined,
          }
        : {}),
      ...(newPassword
        ? {
            passwordHash: await bcrypt.hash(newPassword, 11),
            passwordChangedAt: new Date().toISOString(),
            passwordResetTokenHash: undefined,
            passwordResetExpiresAt: undefined,
          }
        : {}),
      ...(phone ? { phone } : {}),
      mustChangePassword: undefined,
      ...(user.provisionedBy && !user.claimedAt ? { claimedAt: new Date().toISOString() } : {}),
    });
  } catch (e) {
    if (e instanceof Error && e.message === "EMAIL_IN_USE") {
      return NextResponse.json({ error: "Ese correo ya tiene otra cuenta en Cabibee." }, { status: 409 });
    }
    throw e;
  }
  if (!updated) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  if (emailChanged) {
    const profile = getHostProfile(user.id);
    if (!profile?.email || profile.email === user.email || isPlaceholderEmail(profile.email)) {
      upsertHostProfile(user.id, { email });
    }
  }
  if (phone && !getHostProfile(user.id)?.phone) {
    upsertHostProfile(user.id, { phone });
  }
  if (emailChanged || newPassword) {
    await createSession({ id: updated.id, email: updated.email, role: updated.role });
  }
  if (emailChanged) {
    void notifyEmailChanged({ oldEmail: user.email, newEmail: updated.email, fullName: updated.fullName, lang: userLang(updated) });
  }
  if (newPassword) {
    void notifyPasswordChanged({ email: updated.email, fullName: updated.fullName, lang: userLang(updated) });
  }

  let verificationSent = false;
  if (!updated.emailVerifiedAt) {
    verificationSent = await sendVerificationEmail(updated.id, publicOriginFromRequest(req));
  }

  return NextResponse.json({
    ok: true,
    email: updated.email,
    emailVerified: Boolean(updated.emailVerifiedAt),
    verificationSent,
  });
}
