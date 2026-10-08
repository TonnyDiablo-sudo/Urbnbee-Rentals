import "server-only";

export type LocatedPhoto = {
  /** Índice de la captura (0-based). */
  image: number;
  /** [ymin, xmin, ymax, xmax] normalizado 0–1000, convención de Gemini. */
  box: [number, number, number, number];
  label?: string;
};

export type LocateResult = { ok: true; photos: LocatedPhoto[]; model: string } | { ok: false; error: string };

export function geminiPhotoModel(): string {
  return process.env.GEMINI_PHOTO_MODEL?.trim() || "gemini-3.8-flash";
}

/** Gemini 3 se degrada con temperatura baja y acepta nivel de razonamiento; 2.x no lo acepta. */
function generationConfigFor(model: string): Record<string, unknown> {
  if (/^gemini-[3-9]/i.test(model)) {
    return { responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "high" } };
  }
  return { responseMimeType: "application/json", temperature: 0 };
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

const PROMPT = `Recibes capturas de pantalla de un anuncio de alojamiento (Facebook Marketplace, grupos, sitios de anuncios o WhatsApp).
Localiza cada FOTOGRAFÍA del inmueble que aparece dentro de las capturas: interiores, exteriores, recámaras, baños, cocina, alberca, vista.
Excluye: avatares o fotos de perfil, mapas, logotipos, íconos, botones, banners de publicidad, capturas de texto, miniaturas diminutas.
Si la misma foto aparece repetida, inclúyela una sola vez (la versión más grande).
Responde SOLO JSON: {"photos":[{"image":<índice de la captura empezando en 0>,"box_2d":[ymin,xmin,ymax,xmax],"label":"recámara|baño|cocina|sala|exterior|alberca|vista|otro"}]}
Las coordenadas van normalizadas de 0 a 1000 y deben ajustarse al borde de la foto, sin incluir texto ni interfaz alrededor.`;

function clampBox(v: unknown): [number, number, number, number] | null {
  if (!Array.isArray(v) || v.length !== 4) return null;
  const n = v.map((x) => Math.max(0, Math.min(1000, Number(x))));
  if (n.some((x) => !Number.isFinite(x))) return null;
  const [ymin, xmin, ymax, xmax] = n;
  if (ymax - ymin < 40 || xmax - xmin < 40) return null;
  return [ymin, xmin, ymax, xmax];
}

/** Gemini es mucho más preciso que GPT para ubicar regiones dentro de una imagen. */
export async function locatePropertyPhotos(images: { mime: string; base64: string }[]): Promise<LocateResult> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return { ok: false, error: "Falta GEMINI_API_KEY: las fotos no se recortaron." };
  const model = geminiPhotoModel();
  const first = await locateWith(key, model, images);
  if (first.ok || model === FALLBACK_MODEL || !/not found|not supported|is not available|permission/i.test(first.error)) {
    return first;
  }
  return locateWith(key, FALLBACK_MODEL, images);
}

const FALLBACK_MODEL = "gemini-2.5-pro";

async function locateWith(
  key: string,
  model: string,
  images: { mime: string; base64: string }[]
): Promise<LocateResult> {
  const parts: unknown[] = [{ text: PROMPT }];
  images.forEach((img, i) => {
    parts.push({ text: `Captura ${i}:` });
    parts.push({ inline_data: { mime_type: img.mime, data: img.base64 } });
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: generationConfigFor(model),
        }),
      }
    );
    const data = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    if (!res.ok) return { ok: false, error: data.error?.message ?? `Gemini HTTP ${res.status}` };
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as { photos?: unknown[] };
    const photos: LocatedPhoto[] = [];
    for (const raw of parsed.photos ?? []) {
      const p = raw as { image?: unknown; box_2d?: unknown; label?: unknown };
      const image = Number(p.image);
      const box = clampBox(p.box_2d);
      if (!Number.isInteger(image) || image < 0 || image >= images.length || !box) continue;
      photos.push({ image, box, label: typeof p.label === "string" ? p.label : undefined });
    }
    return { ok: true, photos, model };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.includes("abort") ? "Gemini tardó demasiado." : `Gemini: ${msg}` };
  } finally {
    clearTimeout(timeout);
  }
}
