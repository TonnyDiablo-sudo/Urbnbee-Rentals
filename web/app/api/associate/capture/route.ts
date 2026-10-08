import { NextRequest, NextResponse } from "next/server";
import { getAssociateFromRequest } from "@/lib/associate-auth";
import { createDraftFromPage } from "@/lib/associate-capture";
import { listingImportAiEnabled } from "@/lib/listing-import-limits";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_IMAGES = 30;
const MAX_BYTES = 10 * 1024 * 1024;

/** Lo que manda la extensión de Chrome: texto de la página y las imágenes que ella misma descargó. */
export async function POST(req: NextRequest) {
  const associate = await getAssociateFromRequest(req);
  if (!associate) {
    return NextResponse.json({ error: "Token inválido. Genera uno nuevo en Cabibee → Asociados → Extensión." }, { status: 401 });
  }
  if (!listingImportAiEnabled()) {
    return NextResponse.json({ error: "Falta configurar la API key de OpenAI en el servidor." }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "No se pudo leer lo que mandó la extensión." }, { status: 400 });

  const url = String(form.get("url") ?? "").slice(0, 2000);
  if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: "Falta la URL de la página." }, { status: 400 });
  const text = String(form.get("text") ?? "").slice(0, 60_000);
  if (text.trim().length < 40) {
    return NextResponse.json({ error: "La página casi no tiene texto. Abre el anuncio completo y vuelve a intentar." }, { status: 400 });
  }

  const images: Buffer[] = [];
  for (const entry of form.getAll("images")) {
    if (!(entry instanceof File) || entry.size === 0 || entry.size > MAX_BYTES) continue;
    if (!(entry.type || "").startsWith("image/")) continue;
    images.push(Buffer.from(await entry.arrayBuffer()));
    if (images.length >= MAX_IMAGES) break;
  }

  const result = await createDraftFromPage({
    associate,
    url,
    pageTitle: String(form.get("title") ?? "").slice(0, 300),
    text,
    links: String(form.get("links") ?? "")
      .split("\n")
      .map((l) => l.trim().slice(0, 400))
      .filter(Boolean)
      .slice(0, 60),
    images,
    notes: String(form.get("notes") ?? "").trim().slice(0, 2000) || undefined,
    targetHostId: String(form.get("hostId") ?? "").trim() || undefined,
  });
  if (!result.ok) return NextResponse.json({ error: result.error, detail: result.detail }, { status: 502 });
  return NextResponse.json({
    draftId: result.draft.id,
    title: result.draft.listing.title,
    photos: result.draft.photos.length,
  });
}
