import { NextRequest, NextResponse } from "next/server";
import { updateUserAuth } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { parseBillingCountry, regionForCountry } from "@/lib/verification-region";

export const dynamic = "force-dynamic";

/** País para los precios: México en MXN, Estados Unidos u otro país en USD. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { country?: unknown };
  const country = parseBillingCountry(body.country);
  if (!country) return NextResponse.json({ error: "Elige México, Estados Unidos u otro país." }, { status: 400 });
  updateUserAuth(user.id, { billingCountry: country });
  return NextResponse.json({ ok: true, country, region: regionForCountry(country) });
}
