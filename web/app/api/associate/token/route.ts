import { NextResponse } from "next/server";
import { canUseAssociatePanel, issueAssociateToken } from "@/lib/associate-auth";
import { getSessionUser } from "@/lib/session";

/** Sólo con sesión: un token no puede emitir otro. */
export async function POST() {
  const user = await getSessionUser();
  if (!canUseAssociatePanel(user)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json({ token: issueAssociateToken(user.id) });
}
