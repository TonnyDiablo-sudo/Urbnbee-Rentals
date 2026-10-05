import "server-only";
import { NextResponse } from "next/server";
import type { UserRecord } from "@/lib/marketplace-types";
import { hasLegitPhone } from "@/lib/phone-validation";

/**
 * Antes de cobrar: correo propio y confirmado (ahí llegan recibos y avisos de cobro), un teléfono
 * creíble y el país, que decide si se cobra en MXN o USD.
 */
export function purchaseBlockedResponse(user: UserRecord): NextResponse | null {
  return emailNotVerifiedResponse(user) ?? phoneMissingResponse(user) ?? countryMissingResponse(user);
}

/** Para las pantallas de compra: si ya tiene un teléfono que pase la validación. */
export function purchaseHasPhone(user: UserRecord): boolean {
  return user.role === "admin" || hasLegitPhone(user.phone);
}

function phoneMissingResponse(user: UserRecord): NextResponse | null {
  if (purchaseHasPhone(user)) return null;
  return NextResponse.json(
    { error: "Pon tu teléfono antes de comprar.", code: "phone_required" },
    { status: 409 }
  );
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
