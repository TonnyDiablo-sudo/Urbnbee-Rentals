import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { myTeamsView, respondToInvite } from "@/lib/team-service";

/** Invitaciones y equipos de la persona que colabora. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json({ teams: myTeamsView(user) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: string; action?: string };
  if (typeof body.id !== "string" || (body.action !== "accept" && body.action !== "decline")) {
    return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  }
  const r = respondToInvite(user, body.id, body.action === "accept");
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ teams: myTeamsView(user) });
}
