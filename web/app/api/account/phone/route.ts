import { NextRequest, NextResponse } from "next/server";
import { getHostProfile, updateUserAuth, upsertHostProfile } from "@/lib/marketplace-store";
import { normalizeLegitPhone, PHONE_ERROR } from "@/lib/phone-validation";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Teléfono de la cuenta (se pide antes de comprar). */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { phone?: unknown };
  const phone = normalizeLegitPhone(body.phone);
  if (!phone) return NextResponse.json({ error: PHONE_ERROR }, { status: 400 });
  updateUserAuth(user.id, { phone });
  if (!getHostProfile(user.id)?.phone) upsertHostProfile(user.id, { phone });
  return NextResponse.json({ ok: true, phone });
}
