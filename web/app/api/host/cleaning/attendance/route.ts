import { NextRequest, NextResponse } from "next/server";
import { ATTENDANCE_SOON_ERROR, attendanceHistory } from "@/lib/cleaning-attendance";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Historial de entradas y salidas: `?actor=` (host o id de miembro), `?from=` y `?to=` (AAAA-MM-DD). */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const h = attendanceHistory(user.id, { actor: sp.get("actor"), from: sp.get("from"), to: sp.get("to") });
  if (!h) return NextResponse.json({ error: ATTENDANCE_SOON_ERROR }, { status: 403 });
  return NextResponse.json(h);
}
