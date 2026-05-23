import "server-only";
import type { ListingCategory } from "@/lib/mock-data";
import type { ListingImportLlmPayload } from "@/lib/listing-import-types";
import {
  callListingImportOpenAiJson,
  type OpenAiImagePart,
  usageToAction,
  emptyUsageSummary,
} from "@/lib/listing-import-openai";
import type { ListingImportUsageSummary } from "@/lib/listing-import-usage";

const CATEGORIES: ListingCategory[] = [
  "habitaciones",
  "casas",
  "departamentos",
  "cabanas",
  "vinos",
];

const SCHEMA_HINT = `Responde ÚNICAMENTE con un objeto JSON válido (sin markdown), con esta forma:
{
  "title": "string",
  "description": "string (varios párrafos en un solo string)",
  "categoryKey": "habitaciones|casas|departamentos|cabanas|vinos",
  "spaceType": "string",
  "city": "string",
  "zone": "string",
  "county": "string",
  "country": "string",
  "addressLine": "string (sin inventar número interior si no se ve)",
  "guests": number,
  "bedrooms": number,
  "bathrooms": number,
  "size": "string opcional ej. 80 m²",
  "pricePerNight": number,
  "cleaningFee": number,
  "amenities": ["string", ...],
  "rules": { "smoking": boolean, "pets": boolean|null, "parties": boolean, "children": boolean },
  "fieldConfidence": { "campo": "high"|"low", ... },
  "warnings": ["string si algo no se leyó bien"]
}
Si no puedes leer un dato con claridad, omítelo o pon null y añade un warning. No inventes coordenadas GPS. No copies datos de huéspedes.`;

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

function validateCategory(v: unknown): ListingCategory | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return CATEGORIES.includes(s as ListingCategory) ? (s as ListingCategory) : undefined;
}

export function validateListingImportPayload(data: unknown): ListingImportLlmPayload {
  if (!data || typeof data !== "object") throw new Error("La IA no devolvió un objeto JSON válido.");
  const o = data as Record<string, unknown>;

  const rulesRaw = o.rules;
  let rules: ListingImportLlmPayload["rules"];
  if (rulesRaw && typeof rulesRaw === "object") {
    const r = rulesRaw as Record<string, unknown>;
    rules = {
      smoking: typeof r.smoking === "boolean" ? r.smoking : undefined,
      pets: typeof r.pets === "boolean" ? r.pets : r.pets === null ? null : undefined,
      parties: typeof r.parties === "boolean" ? r.parties : undefined,
      children: typeof r.children === "boolean" ? r.children : undefined,
    };
  }

  const amenities = Array.isArray(o.amenities)
    ? o.amenities.filter((a): a is string => typeof a === "string" && a.trim().length > 0).slice(0, 40)
    : undefined;

  const warnings = Array.isArray(o.warnings)
    ? o.warnings.filter((w): w is string => typeof w === "string" && w.trim().length > 0)
    : [];

  const fieldConfidence: Record<string, "high" | "low"> = {};
  if (o.fieldConfidence && typeof o.fieldConfidence === "object") {
    for (const [k, v] of Object.entries(o.fieldConfidence as Record<string, unknown>)) {
      if (v === "high" || v === "low") fieldConfidence[k] = v;
    }
  }

  const title = str(o.title);
  if (!title) throw new Error("No se pudo extraer un título del anuncio.");

  return {
    title,
    description: str(o.description),
    categoryKey: validateCategory(o.categoryKey),
    spaceType: str(o.spaceType),
    city: str(o.city),
    zone: str(o.zone),
    county: str(o.county),
    country: str(o.country),
    addressLine: str(o.addressLine),
    guests: num(o.guests),
    bedrooms: num(o.bedrooms),
    bathrooms: num(o.bathrooms),
    size: str(o.size),
    pricePerNight: num(o.pricePerNight),
    cleaningFee: num(o.cleaningFee),
    amenities,
    rules,
    fieldConfidence: Object.keys(fieldConfidence).length ? fieldConfidence : undefined,
    warnings,
  };
}

export type ListingImportImageInput = { mime: string; base64: string };

export type ListingImportLlmResult =
  | { ok: true; draft: ListingImportLlmPayload; usage: ListingImportUsageSummary }
  | { ok: false; error: string; detail?: string; usage?: ListingImportUsageSummary };

export async function extractListingFromScreenshots(opts: {
  images: ListingImportImageInput[];
  notes?: string;
}): Promise<ListingImportLlmResult> {
  const userText = `Extrae los datos del alojamiento visible en estas capturas de pantalla (pueden ser de Airbnb, Facebook Marketplace u otra plataforma). El anfitrión las subió con permiso.
${opts.notes ? `\nNotas adicionales del anfitrión:\n${opts.notes}` : ""}

${SCHEMA_HINT}`;

  const llm = await callListingImportOpenAiJson<unknown>({
    system:
      "Eres un asistente que extrae datos estructurados de anuncios de alojamiento en español (México). Solo respondes JSON válido según el esquema.",
    userText,
    images: opts.images as OpenAiImagePart[],
    maxTokens: 2500,
    imageDetail: "high",
  });

  if (!llm.ok) {
    return { ok: false, error: llm.error, detail: llm.detail };
  }

  let usage = usageToAction(emptyUsageSummary(), {
    action: "extract_listing_data",
    label: "Extraer datos del anuncio (texto)",
    model: llm.model,
    usage: llm.usage,
  });

  try {
    const draft = validateListingImportPayload(llm.data);
    return { ok: true, draft, usage };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "JSON inválido",
      detail: llm.rawText.slice(0, 800),
      usage,
    };
  }
}

export function draftToListingPartial(draft: ListingImportLlmPayload) {
  return {
    title: draft.title,
    description: draft.description ?? "",
    categoryKey: draft.categoryKey,
    spaceType: draft.spaceType,
    city: draft.city,
    zone: draft.zone,
    county: draft.county,
    country: draft.country ?? "México",
    addressLine: draft.addressLine,
    guests: draft.guests,
    bedrooms: draft.bedrooms,
    bathrooms: draft.bathrooms,
    size: draft.size,
    pricePerNight: draft.pricePerNight,
    cleaningFee: draft.cleaningFee,
    amenities: draft.amenities,
    rules: draft.rules
      ? {
          smoking: draft.rules.smoking ?? false,
          pets: draft.rules.pets ?? null,
          parties: draft.rules.parties ?? false,
          children: draft.rules.children ?? true,
        }
      : undefined,
  };
}
