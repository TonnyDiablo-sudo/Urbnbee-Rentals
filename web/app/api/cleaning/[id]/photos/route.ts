import { NextRequest, NextResponse } from "next/server";
import { addCleaningPhoto } from "@/lib/cleaning-service";
import { PRIVATE_PHOTO_MAX_INPUT_BYTES } from "@/lib/private-files";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Foto de la limpieza terminada: se comprime y se guarda privada. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!file || typeof file === "string") return NextResponse.json({ error: "Falta la foto." }, { status: 400 });
  if (file.size > PRIVATE_PHOTO_MAX_INPUT_BYTES) {
    return NextResponse.json({ error: "La foto pesa más de 10 MB." }, { status: 413 });
  }
  const r = await addCleaningPhoto(user.id, id, Buffer.from(await file.arrayBuffer()));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
