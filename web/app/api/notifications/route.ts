import { NextRequest, NextResponse } from "next/server";
import { listNotifications, markNotificationsRead, unreadNotificationCount } from "@/lib/notifications-store";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json({
    items: listNotifications(user.id),
    unread: unreadNotificationCount(user.id),
  });
}

/** Marca como leídas: `{ ids }` para unas, sin cuerpo para todas. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 200) : undefined;
  const marked = markNotificationsRead(user.id, ids);
  return NextResponse.json({ ok: true, marked, unread: unreadNotificationCount(user.id) });
}
