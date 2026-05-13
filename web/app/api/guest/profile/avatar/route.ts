import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getHostProfile, upsertHostProfile } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { getUploadsDir } from "@/lib/runtime-paths";

const MAX_BYTES = 4 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "guest") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Archivo requerido." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "La imagen supera 4 MB." }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  const ext = MIME_EXT[mime];
  if (!ext) {
    return NextResponse.json({ error: "Formato no permitido (JPG, PNG, WebP, GIF)." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const name = `avatar-${randomUUID()}.${ext}`;
  const dir = path.join(getUploadsDir(), "guest-profiles", user.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);

  const publicUrl = `/uploads/guest-profiles/${user.id}/${name}`;
  upsertHostProfile(user.id, { avatarUrl: publicUrl });

  const profile = getHostProfile(user.id);
  return NextResponse.json({ avatarUrl: publicUrl, profile });
}
