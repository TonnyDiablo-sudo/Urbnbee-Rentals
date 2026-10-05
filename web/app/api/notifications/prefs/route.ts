import { NextRequest, NextResponse } from "next/server";
import { ALARM_CATEGORY_IDS, type AlarmCategory } from "@/lib/alarm-categories";
import { alarmsOff, setAlarm } from "@/lib/notification-prefs-store";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json({ off: alarmsOff(user.id) });
}

/** `{ category, on }` prende o apaga un grupo de avisos (notificación, push y correo); `category: "all"` todos. */
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { category?: unknown; on?: unknown };
  const category = body.category as AlarmCategory | "all";
  if ((category !== "all" && !ALARM_CATEGORY_IDS.includes(category)) || typeof body.on !== "boolean") {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, off: setAlarm(user.id, category, body.on) });
}
