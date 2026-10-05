import "server-only";
import { NextResponse } from "next/server";
import type { UserRecord } from "@/lib/marketplace-types";

/**
 * Antes de cobrar: correo propio y confirmado (ahí llegan recibos y avisos de cobro) y el país,
 * que decide si se cobra en MXN o USD.
 */
export function purchaseBlockedResponse(user: UserRecord): NextResponse | null {
  return emailNotVerifiedResponse(user) ?? countryMissingResponse(user);
}

function countryMissingResponse(user: UserRecord): NextResponse | null {
  if (user.role === "admin" || user.billingCountry) return null;
  return NextResponse.json(
    { error: "Dinos de qué país eres para darte el precio correcto.", code: "country_required" },
    { status: 409 }
  );
}

function emailNotVerifiedResponse(user: UserRecord): NextResponse | null {
  if (user.role === "admin" || user.emailVerifiedAt) return null;
  if (user.placeholderEmail) {
    return NextResponse.json(
      { error: "Antes de comprar pon tu correo personal en tu perfil y confírmalo.", code: "email_placeholder" },
      { status: 403 }
    );
  }
  return NextResponse.json(
    {
      error: "Confirma tu correo antes de comprar. Te mandamos un enlace desde noreply@cabibee.com.",
      code: "email_unverified",
      email: user.email,
    },
    { status: 403 }
  );
}
