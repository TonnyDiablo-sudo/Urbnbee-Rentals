import { NextRequest, NextResponse } from "next/server";
import { createLinkCodeForHost } from "@/lib/beeagent-host-link-store";
import { enqueuePermissionsChanged } from "@/lib/beeagent-outbound";
import { parseAllowedConnectReturnUrl } from "@/lib/beeagent-partner";
import { setBotPermissions } from "@/lib/beeagent-permissions";
import { getSessionUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const rawUrl = typeof body.returnUrl === "string" ? body.returnUrl.trim() : "";
  const state = typeof body.state === "string" ? body.state.trim().slice(0, 200) : "";
  const dest = parseAllowedConnectReturnUrl(rawUrl);
  if (!dest) {
    return NextResponse.json(
      { error: "return_url no permitido.", code: "return_url_rejected" },
      { status: 400 }
    );
  }

  if (body.permissions && typeof body.permissions === "object") {
    const saved = setBotPermissions(user.id, body.permissions);
    enqueuePermissionsChanged(user.id, saved.permissions, saved.updatedAt);
  }

  const { code, expiresAt } = createLinkCodeForHost(user.id);
  dest.searchParams.set("code", code);
  if (state) dest.searchParams.set("state", state);

  return NextResponse.json({
    redirectUrl: dest.toString(),
    expiresAt,
  });
}
