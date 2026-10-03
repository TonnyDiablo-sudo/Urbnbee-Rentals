import "server-only";
import { newDraftId, saveDraft, type AssociateDraft } from "@/lib/associate-drafts-store";
import { extractFromPage, extractFromScreenshots } from "@/lib/associate-extract";
import { cropLocatedPhotos, removeDraftPhotos, saveDraftImage, thumbnailBase64 } from "@/lib/associate-photos";
import { locatePropertyPhotos } from "@/lib/gemini-photo-locator";
import type { ListingSourceKind, UserRecord } from "@/lib/marketplace-types";

export type CaptureResult = { ok: true; draft: AssociateDraft } | { ok: false; error: string; detail?: string };

function lowConfidenceWarning(fc: Record<string, string> | undefined): string[] {
  const low = Object.entries(fc ?? {})
    .filter(([, v]) => v === "low")
    .map(([k]) => k);
  return low.length ? [`Revisa con cuidado: ${low.join(", ")} (la IA no estaba segura).`] : [];
}

function sourceFromUrl(url: string | undefined): { kind: ListingSourceKind; url?: string; site?: string } {
  if (!url) return { kind: "screenshots" };
  try {
    const u = new URL(url);
    const site = u.hostname.replace(/^www\./, "");
    return { kind: /(^|\.)facebook\.com$|(^|\.)fb\.com$/.test(site) ? "facebook" : "web", url: u.toString(), site };
  } catch {
    return { kind: "web" };
  }
}

/** Capturas subidas a mano: GPT lee los datos y Gemini ubica las fotos para recortarlas. */
export async function createDraftFromScreenshots(opts: {
  associate: UserRecord;
  screenshots: { mime: string; data: Buffer }[];
  notes?: string;
  targetHostId?: string;
}): Promise<CaptureResult> {
  const id = newDraftId();
  const images = opts.screenshots.map((s) => ({ mime: s.mime, base64: s.data.toString("base64") }));
  const [text, located] = await Promise.all([
    extractFromScreenshots({ images, notes: opts.notes }),
    locatePropertyPhotos(images),
  ]);
  if (!text.ok) return { ok: false, error: text.error, detail: text.detail };

  const warnings = [...(text.listing.warnings ?? []), ...lowConfidenceWarning(text.listing.fieldConfidence)];
  let photos: string[] = [];
  if (located.ok) {
    photos = await cropLocatedPhotos(
      id,
      opts.screenshots.map((s) => s.data),
      located.photos
    );
    if (!photos.length) warnings.push("No se encontraron fotos del inmueble en las capturas.");
  } else {
    warnings.push(located.error);
  }

  const now = new Date().toISOString();
  return {
    ok: true,
    draft: saveDraft({
      id,
      associateId: opts.associate.id,
      status: "pending",
      source: { kind: "screenshots" },
      listing: text.listing,
      contact: text.contact,
      photos,
      warnings,
      targetHostId: opts.targetHostId,
      model: [text.model, located.ok ? located.model : null].filter(Boolean).join(" + "),
      createdAt: now,
      updatedAt: now,
    }),
  };
}

/** Página abierta en el navegador del asociado (extensión): texto exacto y fotos originales. */
export async function createDraftFromPage(opts: {
  associate: UserRecord;
  url: string;
  pageTitle: string;
  text: string;
  images: Buffer[];
  notes?: string;
  targetHostId?: string;
}): Promise<CaptureResult> {
  const id = newDraftId();
  const saved: string[] = [];
  const thumbs: string[] = [];
  for (const buf of opts.images) {
    const url = await saveDraftImage(id, buf);
    if (!url) continue;
    const thumb = await thumbnailBase64(buf);
    if (!thumb) continue;
    saved.push(url);
    thumbs.push(thumb);
  }

  const text = await extractFromPage({
    url: opts.url,
    pageTitle: opts.pageTitle,
    text: opts.text,
    thumbnails: thumbs,
    notes: opts.notes,
  });
  if (!text.ok) {
    await removeDraftPhotos(id, []);
    return { ok: false, error: text.error, detail: text.detail };
  }

  const photos = text.photoIndexes?.length ? text.photoIndexes.map((i) => saved[i]).filter(Boolean) : saved;
  await removeDraftPhotos(id, photos);
  const warnings = [...(text.listing.warnings ?? []), ...lowConfidenceWarning(text.listing.fieldConfidence)];
  if (!photos.length) warnings.push("No llegaron fotos del inmueble. Abre la galería del anuncio y vuelve a importar.");

  const now = new Date().toISOString();
  return {
    ok: true,
    draft: saveDraft({
      id,
      associateId: opts.associate.id,
      status: "pending",
      source: sourceFromUrl(opts.url),
      listing: text.listing,
      contact: text.contact,
      photos,
      warnings,
      targetHostId: opts.targetHostId,
      model: text.model,
      createdAt: now,
      updatedAt: now,
    }),
  };
}
