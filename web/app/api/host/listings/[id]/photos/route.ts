import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getListingById, updateListing } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { getUploadsDir } from "@/lib/runtime-paths";

const MAX_BYTES = 6 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id: listingId } = await ctx.params;
  const listing = getListingById(listingId);
  if (!listing || listing.hostId !== user.id) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Archivo requerido." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "La imagen supera 6 MB." }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  const ext = MIME_EXT[mime];
  if (!ext) {
    return NextResponse.json({ error: "Formato no permitido (JPG, PNG, WebP, GIF)." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const name = `${randomUUID()}.${ext}`;
  const dir = path.join(getUploadsDir(), "host-listings", listingId);
  await mkdir(dir, { recursive: true });
  const fsPath = path.join(dir, name);
  await writeFile(fsPath, buf);

  const publicUrl = `/uploads/host-listings/${listingId}/${name}`;
  const photos = [...listing.photos, publicUrl];
  updateListing(listingId, user.id, { photos });

  return NextResponse.json({ url: publicUrl, photos });
}
