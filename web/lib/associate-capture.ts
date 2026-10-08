import "server-only";
import { cleanProfileUrl, draftHasContact } from "@/lib/associate-draft-fields";
import { isFacebookUrl } from "@/lib/associate-link-utils";
import { newDraftId, saveDraft, type AssociateDraft, type DraftContact } from "@/lib/associate-drafts-store";
import { streetLineProblem } from "@/lib/listing-address";
import type { ListingImportLlmPayload } from "@/lib/listing-import-types";
import { compressPhoto, deletePrivateFile, putPrivateFile } from "@/lib/private-files";
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

/** Si el anuncio viene de Facebook, el link de contacto es esa publicación del dueño. */
function withFacebookAd(c: DraftContact, url: string | undefined): DraftContact {
  return url && isFacebookUrl(url) ? { ...c, profileUrl: cleanProfileUrl(url) ?? c.profileUrl } : c;
}

function missingContactWarning(c: DraftContact): string[] {
  return draftHasContact(c)
    ? []
    : ["No se encontró cómo contactar al dueño. Agrega su teléfono, correo o su Facebook antes de publicar."];
}

/** Casi ningún anuncio de Facebook o Trovit trae calle y número: entonces queda como aproximada. */
function addressFields(
  listing: ListingImportLlmPayload,
  approx: string | undefined
): Pick<AssociateDraft, "addressMode" | "addressApprox"> {
  if (!streetLineProblem(listing.addressLine)) return { addressMode: "exact", addressApprox: approx };
  const partial = listing.addressLine?.trim();
  listing.addressLine = "";
  return { addressMode: "approximate", addressApprox: [partial, approx].filter(Boolean).join(", ") || undefined };
}

const SOURCE_SHOT_PREFIX = "associate-sources";

async function saveSourceShots(draftId: string, shots: Buffer[]): Promise<string[]> {
  const keys: string[] = [];
  for (const [i, buf] of shots.slice(0, 8).entries()) {
    try {
      const key = `${SOURCE_SHOT_PREFIX}/${draftId}/${i}.webp`;
      await putPrivateFile(key, await compressPhoto(buf), "image/webp");
      keys.push(key);
    } catch {
      /* la revisión usa las que sí se guardaron */
    }
  }
  return keys;
}

export async function removeSourceShots(keys: string[] | undefined): Promise<void> {
  for (const k of keys ?? []) {
    if (k.startsWith(`${SOURCE_SHOT_PREFIX}/`)) await deletePrivateFile(k);
  }
}

/** Capturas subidas a mano: GPT lee los datos y Gemini ubica las fotos para recortarlas. */
export async function createDraftFromScreenshots(opts: {
  associate: UserRecord;
  screenshots: { mime: string; data: Buffer }[];
  notes?: string;
  /** Link del anuncio compartido o pegado junto con las capturas. */
  sourceUrl?: string;
  /** Texto del anuncio que el asociado pegó o compartió. */
  sourceText?: string;
  targetHostId?: string;
}): Promise<CaptureResult> {
  const id = newDraftId();
  const images = opts.screenshots.map((s) => ({ mime: s.mime, base64: s.data.toString("base64") }));
  const notes = [
    opts.sourceUrl ? `Link del anuncio: ${opts.sourceUrl}` : "",
    opts.sourceText ? `Texto del anuncio (copiado tal cual):\n"""\n${opts.sourceText.slice(0, 20_000)}\n"""` : "",
    opts.notes ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const [text, located] = await Promise.all([
    extractFromScreenshots({ images, notes: notes || undefined }),
    locatePropertyPhotos(images),
  ]);
  if (!text.ok) return { ok: false, error: text.error, detail: text.detail };
  const contact = withFacebookAd(text.contact, opts.sourceUrl);

  const warnings = [
    ...(text.listing.warnings ?? []),
    ...lowConfidenceWarning(text.listing.fieldConfidence),
    ...missingContactWarning(contact),
  ];
  const sourceShots = await saveSourceShots(id, opts.screenshots.map((s) => s.data));
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
      source: { ...sourceFromUrl(opts.sourceUrl), kind: "screenshots" },
      listing: text.listing,
      contact,
      photos,
      warnings,
      ...addressFields(text.listing, text.addressApprox),
      sourceShots,
      sourceText: opts.sourceText?.slice(0, 30_000),
      sourceLinks: opts.sourceUrl ? [opts.sourceUrl] : undefined,
      targetHostId: opts.targetHostId,
      model: [text.model, located.ok ? located.model : null].filter(Boolean).join(" + "),
      createdAt: now,
      updatedAt: now,
    }),
  };
}

/**
 * Página del anuncio: la manda la extensión, la lee el servidor desde un link público
 * o es texto que el asociado pegó (sin `url`). Texto exacto y fotos originales.
 */
export async function createDraftFromPage(opts: {
  associate: UserRecord;
  url?: string;
  pageTitle: string;
  text: string;
  links?: string[];
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
    links: opts.links,
    thumbnails: thumbs,
    notes: opts.notes,
  });
  if (!text.ok) {
    await removeDraftPhotos(id, []);
    return { ok: false, error: text.error, detail: text.detail };
  }

  const photos = text.photoIndexes?.length ? text.photoIndexes.map((i) => saved[i]).filter(Boolean) : saved;
  await removeDraftPhotos(id, photos);
  const contact = withFacebookAd(text.contact, opts.url);
  const warnings = [
    ...(text.listing.warnings ?? []),
    ...lowConfidenceWarning(text.listing.fieldConfidence),
    ...missingContactWarning(contact),
  ];
  if (!photos.length) {
    warnings.push(
      opts.url
        ? "No llegaron fotos del inmueble. Abre la galería del anuncio y vuelve a importar, o sube capturas de las fotos."
        : "Sin fotos: agrega capturas de las fotos del inmueble antes de publicar."
    );
  }

  const now = new Date().toISOString();
  return {
    ok: true,
    draft: saveDraft({
      id,
      associateId: opts.associate.id,
      status: "pending",
      source: opts.url ? sourceFromUrl(opts.url) : { kind: "web", site: "Texto pegado" },
      listing: text.listing,
      contact,
      photos,
      warnings,
      ...addressFields(text.listing, text.addressApprox),
      sourceText: opts.text.slice(0, 30_000),
      sourceLinks: opts.links?.slice(0, 60),
      targetHostId: opts.targetHostId,
      model: text.model,
      createdAt: now,
      updatedAt: now,
    }),
  };
}
