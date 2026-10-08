import { NextRequest, NextResponse } from "next/server";
import { getAssociateFromRequest } from "@/lib/associate-auth";
import { createDraftFromPage, createDraftFromScreenshots } from "@/lib/associate-capture";
import { listDraftsForAssociate } from "@/lib/associate-drafts-store";
import { fetchListingPage } from "@/lib/associate-link";
import { firstUrlIn, isLoginWalledUrl } from "@/lib/associate-link-utils";
import { listingImportAiEnabled } from "@/lib/listing-import-limits";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_SCREENSHOTS = 10;
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MIN_TEXT = 40;

export async function GET(req: NextRequest) {
  const associate = await getAssociateFromRequest(req);
  if (!associate) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json({ drafts: listDraftsForAssociate(associate.id, "pending") });
}

/**
 * Lo que el asociado pega, comparte o sube desde el panel (computadora o celular):
 * capturas, el link del anuncio, el texto copiado, o cualquier combinación.
 */
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
  if (screenshots.length > MAX_SCREENSHOTS) {
    return NextResponse.json(
      { error: "Máximo {max} capturas por anuncio.", errorVars: { max: MAX_SCREENSHOTS } },
      { status: 400 }
    );
  }

  const pasted = String(form.get("text") ?? "").trim().slice(0, 30_000);
  const url = (String(form.get("url") ?? "").trim() || firstUrlIn(pasted) || "").slice(0, 2000) || undefined;
  if (url && !/^https?:\/\//i.test(url)) return NextResponse.json({ error: "El link debe empezar con https://" }, { status: 400 });
  const text = url ? pasted.replace(url, "").trim() : pasted;
  const notes = String(form.get("notes") ?? "").trim().slice(0, 4000) || undefined;
  const targetHostId = String(form.get("hostId") ?? "").trim() || undefined;

  if (screenshots.length) {
    const result = await createDraftFromScreenshots({
      associate,
      screenshots,
      notes,
      sourceUrl: url,
      sourceText: text || undefined,
      targetHostId,
    });
    if (!result.ok) return NextResponse.json({ error: result.error, detail: result.detail }, { status: 502 });
    return NextResponse.json({ draft: result.draft });
  }

  let page: { url?: string; title: string; text: string; links: string[]; images: Buffer[] } | null = null;
  let fetchError: string | null = null;
  if (url && !isLoginWalledUrl(url)) {
    const fetched = await fetchListingPage(url);
    if (fetched.ok && fetched.page.text.length >= MIN_TEXT) {
      page = {
        ...fetched.page,
        text: text ? `${fetched.page.text}\n\nTexto que pegó el asociado:\n${text}` : fetched.page.text,
      };
    } else {
      fetchError = fetched.ok ? "La página casi no tiene texto." : fetched.error;
    }
  }
  if (!page && text.length >= MIN_TEXT) {
    page = { url, title: "", text, links: url ? [url] : [], images: [] };
  }

  if (!page) {
    if (url && isLoginWalledUrl(url)) {
      return NextResponse.json(
        {
          error:
            "Facebook e Instagram no dejan que Cabibee abra el anuncio con el puro link. Agrega capturas del anuncio (texto y fotos) o pega también el texto de la publicación.",
          code: "needs_screenshots",
        },
        { status: 422 }
      );
    }
    if (url) {
      return NextResponse.json(
        {
          error: "No se pudo leer ese link: {reason} Prueba subiendo capturas del anuncio o pegando su texto.",
          errorVars: { reason: fetchError ?? "" },
          code: "needs_screenshots",
        },
        { status: 422 }
      );
    }
    return NextResponse.json({ error: "Pega un link, el texto del anuncio o sube capturas." }, { status: 400 });
  }

  const result = await createDraftFromPage({
    associate,
    url: page.url,
    pageTitle: page.title,
    text: page.text,
    links: page.links,
    images: page.images,
    notes,
    targetHostId,
  });
  if (!result.ok) return NextResponse.json({ error: result.error, detail: result.detail }, { status: 502 });
  return NextResponse.json({ draft: result.draft });
}
