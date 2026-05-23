import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { createListing } from "@/lib/marketplace-store";
import {
  LISTING_IMPORT_ALLOWED_MIME,
  LISTING_IMPORT_MAX_BYTES_PER_IMAGE,
  LISTING_IMPORT_MAX_IMAGES,
  LISTING_IMPORT_MAX_NOTES_CHARS,
  LISTING_IMPORT_MAX_TOTAL_BYTES,
  listingImportAiEnabled,
} from "@/lib/listing-import-limits";
import { checkListingImportRateLimit } from "@/lib/listing-import-rate-limit";
import { draftToListingPartial, extractListingFromScreenshots } from "@/lib/listing-import-llm";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!listingImportAiEnabled()) {
    return NextResponse.json(
      { error: "La importación asistida no está habilitada en el servidor." },
      { status: 503 }
    );
  }

  const rate = checkListingImportRateLimit(user.id);
  if (!rate.ok) {
    return NextResponse.json(
      {
        error: `Demasiados intentos. Espera ${Math.ceil(rate.retryAfterSec / 60)} minutos e inténtalo de nuevo.`,
      },
      { status: 429 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer el formulario." }, { status: 400 });
  }

  const consent = form.get("consentAccepted");
  if (consent !== "true" && consent !== "on") {
    return NextResponse.json({ error: "Debes aceptar las condiciones de uso." }, { status: 400 });
  }

  const notesRaw = form.get("notes");
  const notes =
    typeof notesRaw === "string" ? notesRaw.trim().slice(0, LISTING_IMPORT_MAX_NOTES_CHARS) : "";

  const files: File[] = [];
  for (const entry of form.getAll("images")) {
    if (entry instanceof File && entry.size > 0) files.push(entry);
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "Sube al menos una captura (JPEG, PNG o WebP)." }, { status: 400 });
  }
  if (files.length > LISTING_IMPORT_MAX_IMAGES) {
    return NextResponse.json(
      { error: `Máximo ${LISTING_IMPORT_MAX_IMAGES} imágenes por importación.` },
      { status: 400 }
    );
  }

  let totalBytes = 0;
  const images: { mime: string; base64: string }[] = [];

  for (const file of files) {
    const mime = (file.type || "").toLowerCase();
    if (!LISTING_IMPORT_ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { error: `Formato no permitido: ${file.name || "archivo"}. Usa JPEG, PNG o WebP.` },
        { status: 400 }
      );
    }
    if (file.size > LISTING_IMPORT_MAX_BYTES_PER_IMAGE) {
      return NextResponse.json(
        { error: `Cada imagen debe pesar menos de ${LISTING_IMPORT_MAX_BYTES_PER_IMAGE / 1024 / 1024} MB.` },
        { status: 400 }
      );
    }
    totalBytes += file.size;
    if (totalBytes > LISTING_IMPORT_MAX_TOTAL_BYTES) {
      return NextResponse.json({ error: "El total de imágenes supera el límite permitido." }, { status: 413 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    images.push({ mime, base64: buf.toString("base64") });
  }

  const llm = await extractListingFromScreenshots({ images, notes: notes || undefined });
  if (!llm.ok) {
    return NextResponse.json(
      { error: llm.error, detail: llm.detail, usage: llm.usage },
      { status: 502 }
    );
  }

  const partial = draftToListingPartial(llm.draft);
  const listing = createListing(user.id, partial);

  const warnings = [
    ...(llm.draft.warnings ?? []),
    "Sube tus propias fotos en la pestaña Fotos del editor.",
    ...(llm.draft.fieldConfidence &&
    Object.values(llm.draft.fieldConfidence).some((c) => c === "low")
      ? ["Revisa con cuidado los campos marcados con baja confianza (precio, ubicación, reglas)."]
      : []),
  ];

  return NextResponse.json({
    listingId: listing.id,
    listing,
    warnings,
    fieldConfidence: llm.draft.fieldConfidence ?? {},
    usage: llm.usage,
  });
}
