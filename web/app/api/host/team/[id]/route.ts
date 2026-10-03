import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { hostTeamView, revokeTeamMember, updateTeamMemberAccess } from "@/lib/team-service";

type Ctx = { params: Promise<{ id: string }> };

async function hostOnly() {
  const user = await getSessionUser();
  return user && (user.role === "host" || user.role === "admin") ? user : null;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await hostOnly();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = updateTeamMemberAccess(user.id, id, { roles: body.roles, listingIds: body.listingIds });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(hostTeamView(user.id));
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await hostOnly();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await ctx.params;
  const r = revokeTeamMember(user.id, id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(hostTeamView(user.id));
}
