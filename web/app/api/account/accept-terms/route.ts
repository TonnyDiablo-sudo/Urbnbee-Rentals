import { NextRequest, NextResponse } from "next/server";
import { updateUserAuth } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { TERMS_VERSION } from "@/lib/terms";

/** Aceptación de la versión vigente de los Términos de uso (cuentas existentes, reclamadas o activadas). */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (body.accept !== true || body.version !== TERMS_VERSION) {
    return NextResponse.json({ error: "Debes aceptar la versión vigente de los Términos." }, { status: 400 });
  }
  const next = updateUserAuth(user.id, { termsVersion: TERMS_VERSION, termsAcceptedAt: new Date().toISOString() });
  return NextResponse.json({ ok: true, termsVersion: next?.termsVersion, termsAcceptedAt: next?.termsAcceptedAt });
}
