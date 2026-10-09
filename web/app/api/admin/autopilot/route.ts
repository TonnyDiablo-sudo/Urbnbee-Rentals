import { NextResponse } from "next/server";
import { AUTOPILOT_SITES, autopilotSettings, MAX_SITE_LIMIT } from "@/lib/associate-autopilot";
import { saveAutopilotSiteLimits } from "@/lib/autopilot-settings-store";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

/** Topes diarios del piloto automático por página (por asociado). Las páginas que no vienen se quedan igual. */
export async function PATCH(req: Request) {
  const viewer = await getSessionUser();
  if (!viewer || viewer.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { limits?: Record<string, unknown> };
  const limits: Record<string, number> = { ...autopilotSettings().limits };
  for (const site of AUTOPILOT_SITES) {
    if (body.limits?.[site] === undefined) continue;
    const n = Number(body.limits[site]);
    if (!Number.isFinite(n) || n < 0 || n > MAX_SITE_LIMIT) {
      return NextResponse.json({ error: `Tope inválido para ${site} (0 a ${MAX_SITE_LIMIT}).` }, { status: 400 });
    }
    limits[site] = Math.round(n);
  }
  saveAutopilotSiteLimits(limits);
  return NextResponse.json({ ok: true, limits });
}
