import { NextRequest, NextResponse } from "next/server";
import { getAssociateFromRequest } from "@/lib/associate-auth";
import { createDraftFromScreenshots } from "@/lib/associate-capture";
import { listDraftsForAssociate } from "@/lib/associate-drafts-store";
import { listingImportAiEnabled } from "@/lib/listing-import-limits";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_SCREENSHOTS = 10;
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export async function GET(req: NextRequest) {
  const associate = await getAssociateFromRequest(req);
  if (!associate) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json({ drafts: listDraftsForAssociate(associate.id, "pending") });
}

/** Capturas de pantalla (WhatsApp, Marketplace desde el celular, etc.). */
export async function POST(req: NextRequest) {
  const associate = await getAssociateFromRequest(req);
  if (!associate) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!listingImportAiEnabled()) {
    return NextResponse.json({ error: "Falta configurar la API key de OpenAI en el servidor." }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "No se pudo leer el formulario." }, { status: 400 });

  const screenshots: { mime: string; data: Buffer }[] = [];
  for (const entry of form.getAll("images")) {
    if (!(entry instanceof File) || entry.size === 0) continue;
    const mime = (entry.type || "").toLowerCase();
    if (!ALLOWED.has(mime)) {
      return NextResponse.json(
        { error: "Formato no permitido: {name}. Usa JPEG, PNG o WebP.", errorVars: { name: entry.name } },
        { status: 400 }
      );
    }
    if (entry.size > MAX_BYTES) {
      return NextResponse.json({ error: "{name} pesa más de 8 MB.", errorVars: { name: entry.name } }, { status: 400 });
    }
    screenshots.push({ mime: mime === "image/jpg" ? "image/jpeg" : mime, data: Buffer.from(await entry.arrayBuffer()) });
  }
  if (!screenshots.length) return NextResponse.json({ error: "Sube al menos una captura." }, { status: 400 });
  if (screenshots.length > MAX_SCREENSHOTS) {
    return NextResponse.json(
      { error: "Máximo {max} capturas por anuncio.", errorVars: { max: MAX_SCREENSHOTS } },
      { status: 400 }
    );
  }

  const notes = String(form.get("notes") ?? "").trim().slice(0, 4000) || undefined;
  const targetHostId = String(form.get("hostId") ?? "").trim() || undefined;
  const result = await createDraftFromScreenshots({ associate, screenshots, notes, targetHostId });
  if (!result.ok) return NextResponse.json({ error: result.error, detail: result.detail }, { status: 502 });
  return NextResponse.json({ draft: result.draft });
}
