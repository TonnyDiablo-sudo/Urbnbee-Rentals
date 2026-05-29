import { NextResponse } from "next/server";
import { createLinkCodeForHost } from "@/lib/beeagent-host-link-store";
import { getSessionUser } from "@/lib/session";

export async function POST() {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { code, expiresAt } = createLinkCodeForHost(user.id);
  return NextResponse.json({
    code,
    expiresAt,
    expiresInMinutes: 10,
    hint: "Pega este código en urbnbeeai.com al conectar tu agente (tool Host → Conectar urbnbee.net).",
  });
}
