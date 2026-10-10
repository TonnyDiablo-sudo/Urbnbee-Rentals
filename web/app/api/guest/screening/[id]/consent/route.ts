import { NextRequest, NextResponse } from "next/server";
import { screeningBlocked } from "@/lib/screening-guard";
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
  const user = await getSessionUser();
  const blocked = screeningBlocked(req, user);
  if (blocked) return blocked;
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
