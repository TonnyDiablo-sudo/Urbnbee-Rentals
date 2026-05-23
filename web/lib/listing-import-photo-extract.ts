import "server-only";
import sharp from "sharp";
import {
  callListingImportOpenAiJson,
  type OpenAiImagePart,
  usageToAction,
  emptyUsageSummary,
} from "@/lib/listing-import-openai";
import { saveListingPhotoBuffer } from "@/lib/listing-import-photo-storage";
import { updateListing } from "@/lib/marketplace-store";
import type { ListingImportUsageSummary } from "@/lib/listing-import-usage";

export const LISTING_IMPORT_MAX_EXTRACTED_PHOTOS = 30;
const MIN_REGION_FRAC = 0.08;
const MIN_PIXELS = 120;

export type ListingImportImageBuffer = { mime: string; buffer: Buffer };

type NormalizedRegion = { x: number; y: number; w: number; h: number };

type PhotoRegionsPayload = {
  screenshots: Array<{
    imageIndex: number;
    kind: "photo_collage" | "listing_page" | "single_photo" | "text_only" | "other";
    regions: NormalizedRegion[];
  }>;
  warnings?: string[];
};

const PHOTO_SCHEMA = `Responde ÚNICAMENTE con JSON válido (sin markdown):
{
  "screenshots": [
    {
      "imageIndex": 0,
      "kind": "photo_collage|listing_page|single_photo|text_only|other",
      "regions": [{ "x": 0, "y": 0, "w": 1, "h": 1 }]
    }
  ],
  "warnings": ["string opcional"]
}
Reglas:
- imageIndex es el índice de la captura en el orden enviado (0, 1, 2…).
- kind=text_only si solo hay texto/iconos (amenidades, reglas, precios) sin fotos de la propiedad.
- kind=photo_collage si varias fotos del alojamiento en una sola imagen separadas por líneas blancas o rejilla.
- kind=listing_page si es captura de página web: devuelve regions SOLO para cada foto del alojamiento en la galería (no botones, texto, widgets).
- kind=single_photo si es una sola foto de la propiedad (region 0,0,1,1).
- regions: cajas normalizadas 0–1 (x,y esquina superior izquierda; w,h ancho/alto). No incluyas UI, avatares, iconos ni mapas.
- Máximo 12 regions por captura. Si no hay fotos útiles, kind=text_only y regions=[].`;

export type PhotoExtractResult =
  | {
      ok: true;
      photoUrls: string[];
      extractedCount: number;
      skippedScreenshots: number;
      warnings: string[];
      usage: ListingImportUsageSummary;
    }
  | { ok: false; error: string; detail?: string; usage?: ListingImportUsageSummary };

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function normalizeRegion(r: unknown): NormalizedRegion | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const x = clamp01(Number(o.x));
  const y = clamp01(Number(o.y));
  let w = clamp01(Number(o.w));
  let h = clamp01(Number(o.h));
  if (w <= 0 || h <= 0) return null;
  if (x + w > 1) w = 1 - x;
  if (y + h > 1) h = 1 - y;
  if (w < MIN_REGION_FRAC || h < MIN_REGION_FRAC) return null;
  return { x, y, w, h };
}

function parsePhotoRegionsPayload(data: unknown, imageCount: number): PhotoRegionsPayload {
  if (!data || typeof data !== "object") throw new Error("JSON de fotos inválido.");
  const o = data as Record<string, unknown>;
  const warnings = Array.isArray(o.warnings)
    ? o.warnings.filter((w): w is string => typeof w === "string" && w.trim().length > 0)
    : [];

  const screenshots: PhotoRegionsPayload["screenshots"] = [];
  if (Array.isArray(o.screenshots)) {
    for (const item of o.screenshots) {
      if (!item || typeof item !== "object") continue;
      const s = item as Record<string, unknown>;
      const imageIndex = Number(s.imageIndex);
      if (!Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex >= imageCount) continue;
      const kindRaw = typeof s.kind === "string" ? s.kind.trim() : "other";
      const kind = (
        ["photo_collage", "listing_page", "single_photo", "text_only", "other"] as const
      ).includes(kindRaw as PhotoRegionsPayload["screenshots"][0]["kind"])
        ? (kindRaw as PhotoRegionsPayload["screenshots"][0]["kind"])
        : "other";

      const regions: NormalizedRegion[] = [];
      if (Array.isArray(s.regions)) {
        for (const r of s.regions.slice(0, 12)) {
          const norm = normalizeRegion(r);
          if (norm) regions.push(norm);
        }
      }
      screenshots.push({ imageIndex, kind, regions });
    }
  }
  return { screenshots, warnings };
}

async function cropRegion(
  buffer: Buffer,
  region: NormalizedRegion
): Promise<Buffer | null> {
  const meta = await sharp(buffer).metadata();
  const imgW = meta.width ?? 0;
  const imgH = meta.height ?? 0;
  if (imgW < MIN_PIXELS || imgH < MIN_PIXELS) return null;

  const left = Math.floor(region.x * imgW);
  const top = Math.floor(region.y * imgH);
  const width = Math.floor(region.w * imgW);
  const height = Math.floor(region.h * imgH);
  if (width < MIN_PIXELS || height < MIN_PIXELS) return null;
  if (left + width > imgW || top + height > imgH) return null;

  try {
    return await sharp(buffer)
      .extract({ left, top, width, height })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

export async function extractPhotosFromScreenshots(opts: {
  listingId: string;
  hostId: string;
  images: ListingImportImageBuffer[];
}): Promise<PhotoExtractResult> {
  if (opts.images.length === 0) {
    return { ok: false, error: "No hay capturas para extraer fotos." };
  }

  const openAiImages: OpenAiImagePart[] = opts.images.map((img) => ({
    mime: img.mime,
    base64: img.buffer.toString("base64"),
  }));

  const llm = await callListingImportOpenAiJson<unknown>({
    system:
      "Detectas fotos de alojamiento dentro de capturas de pantalla. Solo respondes JSON según el esquema. Coordenadas precisas en 0–1.",
    userText: `Para cada captura (índice 0..${opts.images.length - 1}), indica si contiene fotos del alojamiento y las cajas de recorte.

${PHOTO_SCHEMA}`,
    images: openAiImages,
    maxTokens: 2000,
    imageDetail: "high",
  });

  let usage = emptyUsageSummary();
  if (!llm.ok) {
    return { ok: false, error: llm.error, detail: llm.detail, usage };
  }

  usage = usageToAction(usage, {
    action: "extract_photo_regions",
    label: "Detectar y recortar fotos en capturas",
    model: llm.model,
    usage: llm.usage,
  });

  let payload: PhotoRegionsPayload;
  try {
    payload = parsePhotoRegionsPayload(llm.data, opts.images.length);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudieron leer las regiones de fotos.",
      usage,
    };
  }

  const photoUrls: string[] = [];
  const warnings = [...(payload.warnings ?? [])];
  let skippedScreenshots = 0;

  for (const shot of payload.screenshots) {
    if (shot.kind === "text_only" || shot.regions.length === 0) {
      if (shot.kind === "text_only") skippedScreenshots += 1;
      continue;
    }

    const source = opts.images[shot.imageIndex];
    if (!source) continue;

    for (const region of shot.regions) {
      if (photoUrls.length >= LISTING_IMPORT_MAX_EXTRACTED_PHOTOS) break;
      const cropped = await cropRegion(source.buffer, region);
      if (!cropped) continue;
      const url = await saveListingPhotoBuffer(opts.listingId, cropped, "jpg");
      photoUrls.push(url);
    }
  }

  if (photoUrls.length === 0) {
    warnings.push(
      "No se detectaron fotos recortables en las capturas. Sube fotos manualmente en la pestaña Fotos."
    );
  } else {
    updateListing(opts.listingId, opts.hostId, {
      photos: photoUrls,
    });
  }

  return {
    ok: true,
    photoUrls,
    extractedCount: photoUrls.length,
    skippedScreenshots,
    warnings,
    usage,
  };
}
