import "server-only";
import type { ListingImportLlmPayload } from "@/lib/listing-import-types";
import { validateListingImportPayload } from "@/lib/listing-import-llm";
import { ASSOCIATE_FALLBACK_MODEL, callListingImportOpenAiJson, getAssociateImportModel } from "@/lib/listing-import-openai";
import { cleanProfileUrl } from "@/lib/associate-draft-fields";
import type { DraftContact } from "@/lib/associate-drafts-store";

const SCHEMA = `Responde ÚNICAMENTE con un objeto JSON válido (sin markdown):
{
  "title": "string atractivo y claro, sin emojis ni MAYÚSCULAS sostenidas",
  "description": "string (varios párrafos en un solo string, reescrito en buen español, sin teléfonos ni enlaces)",
  "categoryKey": "habitaciones|casas|departamentos|cabanas|vinos",
  "spaceType": "Espacio completo|Habitación privada|Habitación compartida",
  "city": "string", "zone": "string (colonia o zona)", "county": "string (municipio o alcaldía)", "state": "string (estado)", "country": "string",
  "addressLine": "string (calle y número SOLO si se ven completos; si no, vacío)",
  "addressApprox": "string (si no hay calle y número: la mejor referencia que dé el anuncio, ej. 'a dos cuadras del malecón, Col. Centro')",
  "guests": number, "bedrooms": number, "bathrooms": number,
  "size": "string opcional ej. 80 m²",
  "pricePerNight": number (MXN por noche; si el anuncio da precio por semana o mes, conviértelo y avisa en warnings),
  "cleaningFee": number,
  "amenities": ["string", ...],
  "rules": { "smoking": boolean, "pets": boolean|null, "parties": boolean, "children": boolean },
  "contact": { "hostName": "nombre de quien publica", "phone": "string con lada", "whatsapp": "string", "email": "string", "profileUrl": "enlace al perfil de Facebook o Messenger de quien publica; SOLO facebook.com, fb.com, m.me o messenger.com, nunca Trovit, Inmuebles24 ni otros portales" },
  "fieldConfidence": { "campo": "high"|"low" },
  "warnings": ["string"]PHOTO_FIELD
}
Reglas: no inventes datos; si algo no se ve, omítelo y añade un warning. No inventes coordenadas.
El contacto es obligatorio: busca teléfono, WhatsApp o correo en el texto. Si no hay y el anuncio es de Facebook, pon en profileUrl el enlace al perfil de Facebook de quien publica (de la lista de enlaces si viene). Si el anuncio es de otro sitio, deja profileUrl vacío. Si no encuentras ninguna forma de contacto, dilo en warnings.
Si es renta mensual/larga estancia y no por noche, dilo en warnings. Si no parece un alojamiento, dilo en warnings.`;

const SYSTEM =
  "Eres un analista experto en anuncios de alojamiento en México. Extraes datos con precisión de capturas o del texto de páginas web. Solo respondes JSON válido según el esquema.";

function str(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const t = String(v).trim().slice(0, max);
  return t.length ? t : undefined;
}

function parseContact(raw: unknown): DraftContact {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const email = str(o.email)?.toLowerCase();
  return {
    hostName: str(o.hostName, 120),
    phone: str(o.phone, 40),
    whatsapp: str(o.whatsapp, 40),
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
    profileUrl: cleanProfileUrl(str(o.profileUrl, 500)),
  };
}

export type AssociateExtraction =
  | {
      ok: true;
      listing: ListingImportLlmPayload;
      contact: DraftContact;
      addressApprox?: string;
      photoIndexes?: number[];
      model: string;
    }
  | { ok: false; error: string; detail?: string };

function finish(
  llm: Awaited<ReturnType<typeof callListingImportOpenAiJson<unknown>>>,
  photoCount?: number
): AssociateExtraction {
  if (!llm.ok) return { ok: false, error: llm.error, detail: llm.detail };
  try {
    const listing = validateListingImportPayload(llm.data);
    const o = llm.data as Record<string, unknown>;
    let photoIndexes: number[] | undefined;
    if (photoCount !== undefined && Array.isArray(o.photoIndexes)) {
      const seen = new Set<number>();
      photoIndexes = o.photoIndexes
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 0 && n < photoCount && !seen.has(n) && (seen.add(n), true));
    }
    return {
      ok: true,
      listing,
      contact: parseContact(o.contact),
      addressApprox: str(o.addressApprox, 300),
      photoIndexes,
      model: llm.model,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "JSON inválido", detail: llm.rawText.slice(0, 800) };
  }
}

export async function extractFromScreenshots(opts: {
  images: { mime: string; base64: string }[];
  notes?: string;
}): Promise<AssociateExtraction> {
  const llm = await callListingImportOpenAiJson<unknown>({
    model: getAssociateImportModel(),
    fallbackModel: ASSOCIATE_FALLBACK_MODEL,
    system: SYSTEM,
    userText: `Extrae los datos del alojamiento que aparece en estas capturas (Facebook Marketplace, grupos de Facebook o WhatsApp, u otro sitio de anuncios). Incluye los datos de contacto de quien publica si se ven.
${opts.notes ? `\nNotas del asociado:\n${opts.notes}\n` : ""}
${SCHEMA.replace("PHOTO_FIELD", "")}`,
    images: opts.images,
    imageDetail: "original",
    timeoutMs: 240_000,
  });
  return finish(llm);
}

export async function extractFromPage(opts: {
  url?: string;
  pageTitle: string;
  text: string;
  links?: string[];
  thumbnails: string[];
  notes?: string;
}): Promise<AssociateExtraction> {
  const photoField = `,
  "photoIndexes": [números de las imágenes que SÍ son fotos del inmueble, la mejor para portada primero; excluye avatares, mapas, logos, publicidad y fotos de otros anuncios]`;
  const llm = await callListingImportOpenAiJson<unknown>({
    model: getAssociateImportModel(),
    fallbackModel: ASSOCIATE_FALLBACK_MODEL,
    system: SYSTEM,
    userText: `Página: ${opts.url ?? "(sin link: texto que el asociado copió del anuncio)"}
Título de la pestaña: ${opts.pageTitle}
${opts.notes ? `Notas del asociado: ${opts.notes}\n` : ""}
Texto visible de la página (puede traer menús y anuncios ajenos; quédate solo con el anuncio principal):
"""
${opts.text.slice(0, 30_000)}
"""
${opts.links?.length ? `\nEnlaces de la página (perfiles, WhatsApp, teléfono, correo):\n${opts.links.join("\n")}\n` : ""}
Después van ${opts.thumbnails.length} imágenes de la página, numeradas desde 0 en el orden en que llegan.

${SCHEMA.replace("PHOTO_FIELD", photoField)}`,
    images: opts.thumbnails.map((b) => ({ mime: "image/jpeg", base64: b })),
    imageDetail: "low",
    timeoutMs: 240_000,
  });
  return finish(llm, opts.thumbnails.length);
}
