import "server-only";
import {
  cleanProfileUrl,
  DRAFT_FIELD_LABEL,
  DRAFT_FILLABLE_FIELDS,
  isDraftFillableField,
  type DraftFillableField,
} from "@/lib/associate-draft-fields";
import type { AssociateDraft, DraftReview, DraftReviewIssue } from "@/lib/associate-drafts-store";
import { draftPhotoThumbnails } from "@/lib/associate-photos";
import { ASSOCIATE_FALLBACK_MODEL, callListingImportOpenAiJson, getAssociateImportModel } from "@/lib/listing-import-openai";
import { getPrivateFile } from "@/lib/private-files";

const CATEGORIES = ["habitaciones", "casas", "departamentos", "cabanas", "vinos"] as const;
const SPACE_TYPES = ["Espacio completo", "Habitación privada", "Habitación compartida"];
const MAX_PHOTOS = 12;

const SYSTEM =
  "Eres el supervisor de calidad de Cabibee. Revisas anuncios de alojamiento que otra IA sacó de Facebook, Trovit y sitios parecidos, comparándolos contra la fuente original. Eres estricto y concreto. Solo respondes JSON válido.";

function fieldValue(d: AssociateDraft, f: DraftFillableField): unknown {
  if (f.startsWith("contact.")) return d.contact[f.slice(8) as keyof AssociateDraft["contact"]];
  if (f === "addressApprox") return d.addressApprox;
  return d.listing[f as keyof AssociateDraft["listing"]];
}

function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (typeof v === "number") return !(v > 0);
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function text(v: unknown, max: number): string | undefined {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const t = String(v).replace(/[<>]/g, "").trim().slice(0, max);
  return t || undefined;
}

function positive(v: unknown, max: number): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 && n <= max ? n : undefined;
}

/** Convierte lo que propone la IA al tipo del campo; `undefined` si no sirve. */
function coerce(f: DraftFillableField, v: unknown): unknown {
  switch (f) {
    case "categoryKey":
      return CATEGORIES.find((c) => c === v);
    case "spaceType":
      return SPACE_TYPES.find((s) => s === v);
    case "guests":
    case "bedrooms":
      return positive(v, 60) !== undefined ? Math.round(positive(v, 60)!) : undefined;
    case "bathrooms":
      return positive(v, 40);
    case "pricePerNight":
    case "cleaningFee":
      return positive(v, 500_000);
    case "amenities":
      return Array.isArray(v)
        ? v.map((a) => text(a, 60)).filter((a): a is string => Boolean(a)).slice(0, 40)
        : undefined;
    case "description":
      return text(v, 5000);
    case "contact.email": {
      const e = text(v, 160)?.toLowerCase();
      return e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : undefined;
    }
    case "contact.phone":
    case "contact.whatsapp": {
      const p = text(v, 40)?.replace(/[^\d+\s-]/g, "").trim();
      return p && p.replace(/\D/g, "").length >= 8 ? p : undefined;
    }
    case "contact.profileUrl":
      return cleanProfileUrl(text(v, 500));
    default:
      return text(v, f === "addressApprox" ? 300 : 200);
  }
}

function setField(d: AssociateDraft, f: DraftFillableField, v: unknown): void {
  if (f.startsWith("contact.")) {
    d.contact = { ...d.contact, [f.slice(8)]: v };
  } else if (f === "addressApprox") {
    d.addressApprox = v as string;
  } else {
    d.listing = { ...d.listing, [f]: v };
  }
}

function currentData(d: AssociateDraft): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of DRAFT_FILLABLE_FIELDS) out[f] = fieldValue(d, f) ?? null;
  out.addressMode = d.addressMode ?? "approximate";
  out.addressLine = d.listing.addressLine ?? null;
  out.rules = d.listing.rules ?? null;
  return out;
}

async function sourceShotImages(keys: string[] | undefined): Promise<{ mime: string; base64: string }[]> {
  const out: { mime: string; base64: string }[] = [];
  for (const k of keys ?? []) {
    const buf = await getPrivateFile(k).catch(() => null);
    if (buf) out.push({ mime: "image/webp", base64: buf.toString("base64") });
  }
  return out;
}

export type ReviewOutcome = { ok: true; draft: AssociateDraft } | { ok: false; error: string; detail?: string };

/**
 * Segunda pasada: la IA compara el borrador contra la fuente, avisa lo que no coincide y
 * rellena sólo lo que está vacío. Lo rellenado queda pendiente hasta que el asociado lo aprueba.
 */
export async function reviewDraftWithAi(draft: AssociateDraft): Promise<ReviewOutcome> {
  const shots = await sourceShotImages(draft.sourceShots);
  const photos = await draftPhotoThumbnails(draft.id, draft.photos.slice(0, MAX_PHOTOS));
  const hasText = Boolean(draft.sourceText?.trim());
  if (!hasText && !shots.length) {
    return { ok: false, error: "Este borrador no guardó la página original. Vuelve a importarlo para poder revisarlo con IA." };
  }

  const fieldList = DRAFT_FILLABLE_FIELDS.map((f) => `${f} (${DRAFT_FIELD_LABEL[f]})`).join(", ");
  const textPart = hasText
    ? `FUENTE (texto de la página ${draft.source.url ?? ""}; puede traer menús y anuncios ajenos):
"""
${draft.sourceText!.slice(0, 30_000)}
"""
${draft.sourceLinks?.length ? `Enlaces de la página:\n${draft.sourceLinks.join("\n")}\n` : ""}`
    : "";
  const shotsPart = shots.length
    ? `FUENTE${hasText ? " (además)" : ""}: las primeras ${shots.length} imágenes son capturas de pantalla del anuncio original${draft.source.url ? ` (${draft.source.url})` : ""}.`
    : "";
  const sourcePart = [textPart, shotsPart].filter(Boolean).join("\n");

  const userText = `${sourcePart}
BORRADOR ACTUAL (lo que se va a publicar):
${JSON.stringify(currentData(draft), null, 2)}

FOTOS DEL BORRADOR: ${photos.length ? `las últimas ${photos.length} imágenes, numeradas F1..F${photos.length} en orden (F1 es la portada).` : "ninguna."}

Revisa:
1. Que cada dato del borrador coincida con la fuente (precio, recámaras, baños, huéspedes, ciudad, zona, tipo, contacto). Si no coincide, repórtalo con el valor correcto en "suggested".
2. Contacto (obligatorio): al menos teléfono, WhatsApp, correo o el enlace a su Facebook. Búscalo en el texto y en los enlaces. contact.profileUrl SOLO puede ser de Facebook o Messenger (facebook.com, fb.com, m.me, messenger.com), nunca de Trovit u otro portal. Si la fuente es Facebook y no hay teléfono ni correo, usa el enlace al perfil de quien publica; si no aparece, usa la URL de la publicación: ${draft.source.url ?? "(no hay)"}.
3. Dirección: si hay calle y número en la fuente y el borrador no los tiene, repórtalo con "suggested". Si no hay dirección exacta, rellena addressApprox con la mejor referencia (colonia, cerca de qué, ciudad) a partir de la fuente.
4. Fotos: reporta las que no son del inmueble (mapas, logos, personas, capturas de texto, otro inmueble) o si la portada es mala. Usa field "photos" y di cuál (F#).
5. Datos que faltan: en "fill" pon SOLO campos que hoy están vacíos (null, "" o 0) y cuyo valor sacas de la fuente o deduces con mucha seguridad. No inventes teléfonos, correos ni precios. Campos permitidos: ${fieldList}.

Responde ÚNICAMENTE con JSON:
{
  "summary": "una o dos frases: qué tan listo está para publicar",
  "issues": [{ "field": "campo del borrador o photos|address|contact|general", "severity": "error|warning", "message": "qué está mal, en español claro", "suggested": "valor correcto si aplica" }],
  "fill": { "campo": valor }
}`;

  const llm = await callListingImportOpenAiJson<unknown>({
    model: getAssociateImportModel(),
    fallbackModel: ASSOCIATE_FALLBACK_MODEL,
    system: SYSTEM,
    userText,
    images: [...shots, ...photos.map((b) => ({ mime: "image/jpeg", base64: b }))],
    imageDetail: shots.length ? "high" : "low",
    timeoutMs: 240_000,
  });
  if (!llm.ok) return { ok: false, error: llm.error, detail: llm.detail };
  if (!llm.data || typeof llm.data !== "object") {
    return { ok: false, error: "La IA no devolvió una revisión válida.", detail: llm.rawText.slice(0, 800) };
  }
  const o = llm.data as Record<string, unknown>;

  const issues: DraftReviewIssue[] = (Array.isArray(o.issues) ? o.issues : [])
    .map((raw): DraftReviewIssue | null => {
      if (!raw || typeof raw !== "object") return null;
      const i = raw as Record<string, unknown>;
      const message = text(i.message, 400);
      if (!message) return null;
      return {
        field: text(i.field, 40) ?? "general",
        severity: i.severity === "error" ? "error" : "warning",
        message,
        suggested: text(i.suggested, 300),
      };
    })
    .filter((i): i is DraftReviewIssue => Boolean(i))
    .slice(0, 30);

  const next: AssociateDraft = { ...draft, listing: { ...draft.listing }, contact: { ...draft.contact } };
  const filled: DraftFillableField[] = [];
  const fill = o.fill && typeof o.fill === "object" ? (o.fill as Record<string, unknown>) : {};
  for (const [k, raw] of Object.entries(fill)) {
    if (!isDraftFillableField(k) || !isEmpty(fieldValue(next, k))) continue;
    if (k === "addressApprox" && next.addressMode === "exact") continue;
    const v = coerce(k, raw);
    if (isEmpty(v)) continue;
    setField(next, k, v);
    filled.push(k);
  }

  const review: DraftReview = {
    at: new Date().toISOString(),
    model: llm.model,
    summary: text(o.summary, 400),
    issues,
    filled,
  };
  next.review = review;
  next.aiFilled = Array.from(new Set([...(draft.aiFilled ?? []), ...filled]));
  next.updatedAt = review.at;
  return { ok: true, draft: next };
}
