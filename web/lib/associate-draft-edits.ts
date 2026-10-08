import "server-only";
import {
  cleanProfileUrl,
  draftHasContact,
  isDraftFillableField,
  type DraftFillableField,
} from "@/lib/associate-draft-fields";
import type { AssociateDraft, DraftContact } from "@/lib/associate-drafts-store";
import { streetLineProblem } from "@/lib/listing-address";
import { validateListingImportPayload } from "@/lib/listing-import-llm";
import type { ListingImportLlmPayload } from "@/lib/listing-import-types";

/** Lo que el asociado tiene en pantalla: se manda igual al revisar con IA y al publicar. */
export type DraftEdits = {
  listing: ListingImportLlmPayload;
  contact: DraftContact;
  photos: string[];
  addressMode: "exact" | "approximate";
  addressApprox?: string;
  approvedAiFields: DraftFillableField[];
};

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/[<>]/g, "").trim().slice(0, max);
  return t || undefined;
}

export function parseDraftEdits(body: Record<string, unknown>): { ok: true; edits: DraftEdits } | { ok: false; error: string } {
  let listing: ListingImportLlmPayload;
  const raw = (body.listing && typeof body.listing === "object" ? body.listing : {}) as Record<string, unknown>;
  const hasTitle = typeof raw.title === "string" && raw.title.trim().length > 0;
  try {
    listing = validateListingImportPayload(hasTitle ? raw : { ...raw, title: "-" });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Datos inválidos." };
  }
  if (!hasTitle) listing.title = undefined;
  const c = (body.contact ?? {}) as Record<string, unknown>;
  const email = str(c.email, 160)?.toLowerCase();
  const contact: DraftContact = {
    hostName: str(c.hostName, 120),
    phone: str(c.phone, 40),
    whatsapp: str(c.whatsapp, 40),
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
    profileUrl: cleanProfileUrl(str(c.profileUrl, 500)),
  };
  const addressMode = body.addressMode === "exact" ? "exact" : "approximate";
  if (addressMode === "approximate") listing.addressLine = "";
  return {
    ok: true,
    edits: {
      listing,
      contact,
      photos: Array.isArray(body.photos) ? body.photos.filter((p): p is string => typeof p === "string").slice(0, 60) : [],
      addressMode,
      addressApprox: str(body.addressApprox, 300),
      approvedAiFields: Array.isArray(body.approvedAiFields) ? body.approvedAiFields.filter(isDraftFillableField) : [],
    },
  };
}

/** Aplica lo de pantalla al borrador. Las fotos sólo pueden ser las que ya trae el borrador. */
export function applyDraftEdits(draft: AssociateDraft, edits: DraftEdits): AssociateDraft {
  const approved = new Set(edits.approvedAiFields);
  const pool = [...draft.photos, ...(draft.removedPhotos ?? [])];
  const photos = [...new Set(edits.photos)].filter((p) => pool.includes(p));
  return {
    ...draft,
    listing: edits.listing,
    contact: edits.contact,
    photos,
    removedPhotos: pool.filter((p) => !photos.includes(p)),
    addressMode: edits.addressMode,
    addressApprox: edits.addressApprox,
    aiFilled: (draft.aiFilled ?? []).filter((f) => !approved.has(f)),
    updatedAt: new Date().toISOString(),
  };
}

/** Lo mínimo para publicar una cuenta creada por un asociado: fotos, contacto y ubicación. */
export function draftPublishProblems(
  d: Pick<AssociateDraft, "listing" | "contact" | "photos" | "addressMode" | "addressApprox" | "aiFilled">,
  opts: { hostHasContact?: boolean } = {}
): string[] {
  const problems: string[] = [];
  if (!d.listing.title?.trim()) problems.push("El anuncio necesita título.");
  if (!d.photos.length) problems.push("Agrega al menos una foto del inmueble.");
  if (!draftHasContact(d.contact) && !opts.hostHasContact) {
    problems.push("Falta el contacto del dueño: teléfono, WhatsApp, correo o el enlace a su perfil.");
  }
  if (!d.listing.city?.trim()) problems.push("Falta la ciudad.");
  if (d.addressMode === "exact") {
    const p = streetLineProblem(d.listing.addressLine);
    if (p) problems.push(p);
  } else if (!d.listing.zone?.trim() && !d.addressApprox?.trim()) {
    problems.push("Escribe la colonia o una ubicación aproximada.");
  }
  if (d.aiFilled?.length) problems.push("Aprueba los campos que rellenó la IA (marcados en rojo).");
  return problems;
}
