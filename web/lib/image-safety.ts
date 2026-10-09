import "server-only";
import { getEffectiveBlogBotApiKey } from "@/lib/blog-bot-store";

const BLOCKED = ["sexual", "sexual/minors", "violence", "violence/graphic"] as const;

/**
 * Clasificador de imágenes (no es el modelo de las reseñas). Se llama una vez al subir.
 * Si no hay respuesta, la foto no se guarda.
 */
export async function imageSafetyError(data: Buffer, mime: string): Promise<string | null> {
  const key = getEffectiveBlogBotApiKey();
  if (!key) return "No pudimos revisar la foto. Intenta de nuevo.";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: [
          {
            type: "image_url",
            image_url: { url: `data:${mime};base64,${data.toString("base64")}` },
          },
        ],
      }),
    });
    if (!res.ok) {
      console.warn("[image safety] status", res.status);
      return "No pudimos revisar la foto. Intenta de nuevo.";
    }
    const json = (await res.json()) as {
      results?: { categories?: Record<string, boolean> }[];
    };
    const categories = json.results?.[0]?.categories;
    if (!categories) return "No pudimos revisar la foto. Intenta de nuevo.";
    if (BLOCKED.some((name) => categories[name])) return "Esta foto no se puede usar.";
    return null;
  } catch (e) {
    console.warn("[image safety]", e instanceof Error ? e.message : e);
    return "No pudimos revisar la foto. Intenta de nuevo.";
  } finally {
    clearTimeout(timer);
  }
}
