import { NextRequest, NextResponse } from "next/server";
import { getAssociateFromRequest } from "@/lib/associate-auth";
import { getDraft } from "@/lib/associate-drafts-store";
import { discardDraft } from "@/lib/associate-provision";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const associate = await getAssociateFromRequest(req);
  if (!associate) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await ctx.params;
  const draft = getDraft(id);
  if (!draft || (draft.associateId !== associate.id && associate.role !== "admin")) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  return NextResponse.json({ draft });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const associate = await getAssociateFromRequest(req);
  if (!associate) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await ctx.params;
  const draft = await discardDraft(associate, id);
  if (!draft) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
