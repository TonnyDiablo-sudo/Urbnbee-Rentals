import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { createTeamChannel, teamChannelsView } from "@/lib/team-chat-service";

export const dynamic = "force-dynamic";

/** Chats de equipo de un anfitrión: `?host=` (por defecto, el propio). */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const hostId = req.nextUrl.searchParams.get("host") || user.id;
  const r = teamChannelsView(user.id, hostId);
  if (!r.ok) return NextResponse.json({ error: r.error, channels: [] }, { status: r.status });
  return NextResponse.json({ channels: r.channels, people: r.people, me: r.me, isHost: r.isHost });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { host?: string; name?: unknown; emoji?: unknown; memberIds?: unknown; direct?: unknown };
  const r = createTeamChannel(user.id, typeof body.host === "string" && body.host ? body.host : user.id, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, id: r.id });
}
