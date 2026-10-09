import { NextRequest, NextResponse } from "next/server";
import { getAssociateFromRequest } from "@/lib/associate-auth";
import { canUseAutopilot } from "@/lib/associate-autopilot";
import { leaseAutopilotPhone } from "@/lib/autopilot-phones";

export const runtime = "nodejs";

/** El piloto pide una línea de Cabibee para el formulario que esconde el WhatsApp del anunciante. */
export async function POST(req: NextRequest) {
  const associate = await getAssociateFromRequest(req);
  if (!associate) return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  if (!canUseAutopilot(associate)) return NextResponse.json({ error: "Sólo para Asociado Plus." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url : "";
  if (!/^https?:\/\//.test(url)) return NextResponse.json({ error: "Falta la URL del anuncio." }, { status: 400 });
  return NextResponse.json(leaseAutopilotPhone({ url, associateId: associate.id }));
}
