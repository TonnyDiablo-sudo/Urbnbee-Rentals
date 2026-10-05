import { NextRequest, NextResponse } from "next/server";
import { CREDIT_CHECK_ENABLED } from "@/lib/feature-flags";
import { getSessionUser } from "@/lib/session";
import { guestConsentScreening, screeningPublicView } from "@/lib/screening-service";

export const dynamic = "force-dynamic";

function requestIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!CREDIT_CHECK_ENABLED) {
    return NextResponse.json({ error: "La revisión de historial crediticio todavía no está disponible." }, { status: 403 });
  }
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const next = guestConsentScreening(id, user.id, requestIp(req));
  if (!next) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, screening: screeningPublicView(next) });
}
