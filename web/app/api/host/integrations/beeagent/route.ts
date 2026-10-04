import { NextRequest, NextResponse } from "next/server";
import { getBeeagentAgentStatus } from "@/lib/beeagent-agent-status";
import { getBeeagentLinkForHost } from "@/lib/beeagent-host-link-store";
import { enqueuePermissionsChanged } from "@/lib/beeagent-outbound";
import { beeagentConnectStartUrl } from "@/lib/beeagent-partner";
import { getBotPermissions, getBotPermissionsUpdatedAt, setBotPermissions } from "@/lib/beeagent-permissions";
import { getSessionUser } from "@/lib/session";

const DEFAULT_SIGNUP = "https://www.urbnbeeai.com/signup";

export async function GET() {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const link = getBeeagentLinkForHost(user.id);
  return NextResponse.json({
    linked: Boolean(link),
    hostId: user.id,
    beeagentCustomerId: link?.beeagentCustomerId ?? null,
    linkedAt: link?.linkedAt ?? null,
    signupUrl: process.env.URBNBEEAI_SIGNUP_URL?.trim() || DEFAULT_SIGNUP,
    startUrl: beeagentConnectStartUrl(),
    agentStatus: getBeeagentAgentStatus(user.id) ?? null,
    permissions: getBotPermissions(user.id),
    permissionsUpdatedAt: getBotPermissionsUpdatedAt(user.id),
  });
}

/** El anfitrión cambia lo que puede hacer el agente; urbnbeeai recibe host.permissions_changed. */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { permissions?: unknown };
  if (!body.permissions || typeof body.permissions !== "object") {
    return NextResponse.json({ error: "Faltan los permisos." }, { status: 400 });
  }
  const saved = setBotPermissions(user.id, body.permissions);
  enqueuePermissionsChanged(user.id, saved.permissions, saved.updatedAt);
  return NextResponse.json({ ok: true, permissions: saved.permissions, permissionsUpdatedAt: saved.updatedAt });
}
