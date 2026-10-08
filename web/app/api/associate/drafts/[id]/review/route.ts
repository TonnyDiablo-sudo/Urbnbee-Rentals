import { NextRequest, NextResponse } from "next/server";
import { getAssociateFromRequest } from "@/lib/associate-auth";
import { applyDraftEdits, parseDraftEdits } from "@/lib/associate-draft-edits";
import { draftForClient, getDraft, saveDraft } from "@/lib/associate-drafts-store";
import { reviewDraftWithAi } from "@/lib/associate-review";
import { listingImportAiEnabled } from "@/lib/listing-import-limits";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Guarda lo que hay en pantalla y le pide a la IA que revise su propio trabajo contra la fuente. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const associate = await getAssociateFromRequest(req);
  if (!associate) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!listingImportAiEnabled()) {
    return NextResponse.json({ error: "Falta configurar la API key de OpenAI en el servidor." }, { status: 503 });
  }
  const { id } = await ctx.params;
  const draft = getDraft(id);
  if (!draft || (draft.associateId !== associate.id && associate.role !== "admin")) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  if (draft.status !== "pending") return NextResponse.json({ error: "Este borrador ya se procesó." }, { status: 409 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const parsed = parseDraftEdits(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const edited = saveDraft(applyDraftEdits(draft, parsed.edits));
  const result = await reviewDraftWithAi(edited);
  if (!result.ok) return NextResponse.json({ error: result.error, detail: result.detail }, { status: 502 });

  return NextResponse.json({ draft: draftForClient(saveDraft(result.draft)) });
}
