import { NextRequest, NextResponse } from "next/server";
import { getAssociateFromRequest } from "@/lib/associate-auth";
import { deleteShare, getShareImage } from "@/lib/associate-shares";

export const runtime = "nodejs";

/** `?img=N`: captura N de lo compartido, para precargarla en el formulario. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const associate = await getAssociateFromRequest(req);
  if (!associate) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await params;
  const index = Number(req.nextUrl.searchParams.get("img"));
  if (!Number.isInteger(index) || index < 0) return NextResponse.json({ error: "Falta img." }, { status: 400 });
  const img = await getShareImage(associate.id, id, index);
  if (!img) return NextResponse.json({ error: "No existe." }, { status: 404 });
  return new NextResponse(new Uint8Array(img.data), {
    headers: { "Content-Type": img.mime, "Cache-Control": "private, no-store" },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const associate = await getAssociateFromRequest(req);
  if (!associate) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await params;
  await deleteShare(associate.id, id);
  return NextResponse.json({ ok: true });
}
