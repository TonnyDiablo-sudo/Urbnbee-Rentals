import { NextRequest, NextResponse } from "next/server";
import { readCleaningPhoto, removeCleaningPhoto } from "@/lib/cleaning-service";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; photoId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { id, photoId } = await ctx.params;
  const buf = await readCleaningPhoto(user.id, id, photoId);
  if (!buf) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: { "content-type": "image/webp", "cache-control": "private, max-age=3600" },
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id, photoId } = await ctx.params;
  const r = await removeCleaningPhoto(user.id, id, photoId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
