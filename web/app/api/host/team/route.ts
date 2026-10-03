import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { hostTeamView, inviteTeamMember } from "@/lib/team-service";

async function hostOnly() {
  const user = await getSessionUser();
  return user && (user.role === "host" || user.role === "admin") ? user : null;
}

export async function GET() {
  const user = await hostOnly();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json(hostTeamView(user.id));
}

/** Invita a una persona con cuenta de Cabibee, con sus roles y anuncios. */
export async function POST(req: NextRequest) {
  const user = await hostOnly();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = inviteTeamMember(user.id, { email: body.email, roles: body.roles, listingIds: body.listingIds });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(hostTeamView(user.id));
}
