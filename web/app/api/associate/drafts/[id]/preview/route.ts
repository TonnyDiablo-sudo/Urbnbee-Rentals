import { NextRequest, NextResponse } from "next/server";
import { getAssociateFromRequest } from "@/lib/associate-auth";
import { parseDraftEdits } from "@/lib/associate-draft-edits";
import { savePreview } from "@/lib/associate-preview-store";
import { buildDraftPreview, parsePublishTarget } from "@/lib/associate-provision";

export const runtime = "nodejs";

/** Arma el anuncio como quedaría publicado (con lo que hay en pantalla) y regresa la URL para verlo. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const associate = await getAssociateFromRequest(req);
  if (!associate) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const parsed = parseDraftEdits(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const target = parsePublishTarget(body.target, parsed.edits.contact);

  const result = await buildDraftPreview({ associate, draftId: id, edits: parsed.edits, target });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const token = savePreview(associate.id, result.preview);
  return NextResponse.json({ url: `/vista-previa/${token}`, mapFound: result.preview.mapFound });
}
