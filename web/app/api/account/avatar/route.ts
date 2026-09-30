import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { upsertHostProfile } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { getUploadsDir } from "@/lib/runtime-paths";

const MAX_BYTES = 6 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Foto de perfil de cualquier cuenta. La app la recorta y comprime antes de subirla. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Elige una foto." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "La foto pesa más de 6 MB." }, { status: 400 });
  }
  const ext = MIME_EXT[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Formato no permitido (JPG, PNG, WebP o GIF)." }, { status: 400 });
  }

  const name = `avatar-${randomUUID()}.${ext}`;
  const dir = path.join(getUploadsDir(), "profiles", user.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));

  const avatarUrl = `/uploads/profiles/${user.id}/${name}`;
  upsertHostProfile(user.id, { avatarUrl });
  return NextResponse.json({ ok: true, avatarUrl });
}
