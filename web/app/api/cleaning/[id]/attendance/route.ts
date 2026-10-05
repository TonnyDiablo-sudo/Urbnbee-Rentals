import { NextRequest, NextResponse } from "next/server";
import { attendanceEnabled } from "@/lib/attendance-flag";
import { punchCleaning, taskAttendance } from "@/lib/cleaning-attendance";
import { canSeeCleaning } from "@/lib/cleaning-service";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await ctx.params;
  if (!canSeeCleaning(user.id, id)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  return NextResponse.json({ enabled: attendanceEnabled(), ...taskAttendance(user.id, id) });
}

/** Marca entrada o salida: `{ kind, lat, lng, accuracy, platform }`. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = punchCleaning(user.id, id, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, onSite: r.onSite, distanceM: r.distanceM, ...taskAttendance(user.id, id) });
}
