import { NextRequest, NextResponse } from "next/server";
import { getAssociateFromRequest } from "@/lib/associate-auth";
import { sendOutreach, setOutreachStatus } from "@/lib/associate-outreach";
import type { OutreachChannel, OutreachManualStatus } from "@/lib/associate-outreach-store";
import { publicOriginFromRequest } from "@/lib/public-origin";

export const runtime = "nodejs";

const CHANNELS: OutreachChannel[] = ["whatsapp", "whatsapp_api", "messenger", "email"];
const STATUSES: OutreachManualStatus[] = ["pendiente", "enviado", "respondio", "no_quiere"];

/** `{ channel }` manda (o prepara) el aviso al dueño; `{ status }` lo marca a mano. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ hostId: string }> }) {
  const associate = await getAssociateFromRequest(req);
  if (!associate) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  const { hostId } = await params;
  const body = (await req.json().catch(() => null)) as { channel?: unknown; status?: unknown; force?: unknown } | null;

  if (typeof body?.status === "string") {
    if (!STATUSES.includes(body.status as OutreachManualStatus)) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
    const res = setOutreachStatus(associate, hostId, body.status as OutreachManualStatus);
    return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: res.error }, { status: 404 });
  }

  const channel = body?.channel as OutreachChannel;
  if (!CHANNELS.includes(channel)) return NextResponse.json({ error: "Canal inválido." }, { status: 400 });
  const res = await sendOutreach(associate, hostId, channel, publicOriginFromRequest(req), { force: body?.force === true });
  if (!res.ok) return NextResponse.json({ error: res.error, waitSec: res.waitSec, code: res.code }, { status: res.status });
  return NextResponse.json(res);
}
