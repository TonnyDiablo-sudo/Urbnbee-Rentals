import "server-only";
import { NextResponse } from "next/server";
import type { UserRecord } from "@/lib/marketplace-types";

/** Correo propio y confirmado. Los admins pasan siempre. */
export function emailConfirmed(user: Pick<UserRecord, "role" | "emailVerifiedAt"> | null | undefined): boolean {
  return Boolean(user && (user.role === "admin" || user.emailVerifiedAt));
}

const ERRORS = {
  favorites: "Confirma tu correo para crear listas de favoritos.",
  message: "Confirma tu correo para escribirle al anfitrión.",
  contacts: "Confirma tu correo para ver los datos de contacto del anfitrión.",
} as const;

/** 403 con `needsEmail` si falta confirmar el correo; si no, null. */
export function emailRequiredResponse(user: UserRecord, action: keyof typeof ERRORS): NextResponse | null {
  if (emailConfirmed(user)) return null;
  return NextResponse.json(
    {
      error: ERRORS[action],
      needsEmail: true,
      code: user.placeholderEmail ? "email_placeholder" : "email_unverified",
      email: user.email,
    },
    { status: 403 }
  );
}
