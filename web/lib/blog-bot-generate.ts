import "server-only";
import type { BlogBotConfigRecord, GeneratedBlogPostPayload } from "@/lib/blog-bot-types";
import { getBlogBotConfig, getEffectiveBlogBotApiKey } from "@/lib/blog-bot-store";

const JSON_SCHEMA_HINT = `Debes responder ÚNICAMENTE con un objeto JSON válido (sin markdown, sin texto antes ni después), con esta forma exacta:
{
  "slug": "texto-en-kebab-case-sin-acentos",
  "title": "string",
  "publishedAt": "YYYY-MM-DD",
  "excerpt": "1-2 frases",
  "paragraphs": ["párrafo 1", "párrafo 2", "..."]
}
Los párrafos deben ser 4 a 8 bloques de texto en español (México), útiles para huéspedes y anfitriones.`;

export function buildBlogGenerationSystemPrompt(config: BlogBotConfigRecord): string {
  return `Eres el redactor del blog oficial de Urbnbee (plataforma de alojamientos y reservas) y Urbnbee AI (asistente en listados y comunicación).

Objetivo de cada artículo:
- Educar sobre buenas prácticas de hospedaje, confianza, precios, temporada alta/baja, comunicación con huéspedes.
- Mencionar de forma natural la marca Urbnbee y, cuando encaje, Urbnbee AI (sin inventar funciones que no existan: reservas, verificación de huéspedes, tarifas, calendario, chat en la página).
- No dar datos personales inventados ni URLs falsas. No prometer descuentos irreales.

${JSON_SCHEMA_HINT}

Instrucciones adicionales del equipo editorial:
${config.systemPromptAppend.trim() || "(ninguna)"}

Palabras clave y temas a integrar con naturalidad:
${config.brandKeywords.trim() || "Urbnbee, alojamientos, reservas"}`;
}

export function buildBlogGenerationUserPrompt(dateIso: string, topicAngle?: string): string {
  const d = new Date(dateIso);
  const readable = d.toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const tema =
    topicAngle?.trim() ||
    "Elige un ángulo concreto ligado a Urbnbee (sin repetir títulos genéricos de otros blogs).";
  return `Fecha del artículo (publicación): ${dateIso} (${readable}).

Tema central que debes desarrollar en profundidad:
"${tema}"

El contenido debe ser útil para anfitriones o huéspedes, mencionar Urbnbee / Urbnbee AI cuando encaje, y mantener tono honesto (sin inventar funciones).

Recuerda: salida solo JSON según el esquema acordado.`;
}

export type GenerateBlogPostOptions = {
  dateIso?: string;
  topicAngle?: string;
  skipEnabledCheck?: boolean;
};

export type GenerateBlogPostResult =
  | { ok: true; post: GeneratedBlogPostPayload; rawModelText?: string }
  | { ok: false; error: string; detail?: string };

function stripJsonFence(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "");
    s = s.replace(/\s*```\s*$/i, "");
  }
  return s.trim();
}

function validatePayload(data: unknown): GeneratedBlogPostPayload {
  if (!data || typeof data !== "object") throw new Error("Respuesta no es un objeto JSON");
  const o = data as Record<string, unknown>;
  const slug = typeof o.slug === "string" ? o.slug.trim() : "";
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const publishedAt = typeof o.publishedAt === "string" ? o.publishedAt.trim() : "";
  const excerpt = typeof o.excerpt === "string" ? o.excerpt.trim() : "";
  const paragraphs = Array.isArray(o.paragraphs)
    ? o.paragraphs.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    : [];
  if (!slug || !title || !publishedAt || !excerpt || paragraphs.length < 2) {
    throw new Error("JSON incompleto: slug, title, publishedAt, excerpt y al menos 2 párrafos");
  }
  return { slug, title, publishedAt, excerpt, paragraphs };
}

export async function generateBlogPostWithLlm(
  opts?: GenerateBlogPostOptions
): Promise<GenerateBlogPostResult> {
  const config = getBlogBotConfig();
  const apiKey = getEffectiveBlogBotApiKey();
  if (!opts?.skipEnabledCheck && !config.enabled) {
    return { ok: false, error: "El bot de blog está deshabilitado en la configuración." };
  }
  if (!apiKey) {
    return {
      ok: false,
      error:
        "No hay API key configurada. Define BLOG_BOT_OPENAI_API_KEY u OPENAI_API_KEY en el servidor, o guarda una clave en esta pantalla.",
    };
  }

  const date = opts?.dateIso ?? new Date().toISOString().slice(0, 10);
  const url =
    config.chatCompletionsUrl?.trim() ||
    `${config.apiBaseUrl.replace(/\/$/, "")}/chat/completions`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(5000, config.timeoutMs));

  const messages = [
    { role: "system", content: buildBlogGenerationSystemPrompt(config) },
    { role: "user", content: buildBlogGenerationUserPrompt(date, opts?.topicAngle) },
  ];
  const baseBody = {
    model: config.model,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
  };
  const bodyFirst = { ...baseBody, response_format: { type: "json_object" as const } };
  const bodyFallback = baseBody;

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(bodyFirst),
    });

    let data = (await res.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };

    const unsupportedJsonMode =
      !res.ok &&
      typeof data.error?.message === "string" &&
      /response_format|json_object|unsupported/i.test(data.error.message);

    if (unsupportedJsonMode) {
      const res2 = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(bodyFallback),
      });
      data = (await res2.json()) as typeof data;
      if (!res2.ok) {
        return {
          ok: false,
          error: data.error?.message ?? `HTTP ${res2.status}`,
        };
      }
    } else if (!res.ok) {
      return {
        ok: false,
        error: data.error?.message ?? `HTTP ${res.status}`,
      };
    }

    const rawText = data.choices?.[0]?.message?.content?.trim();
    if (!rawText) {
      return { ok: false, error: "El modelo no devolvió contenido." };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFence(rawText));
    } catch {
      return {
        ok: false,
        error: "La respuesta no es JSON válido.",
        detail: rawText.slice(0, 500),
      };
    }

    try {
      const post = validatePayload(parsed);
      return { ok: true, post, rawModelText: rawText };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "JSON inválido",
        detail: rawText.slice(0, 800),
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("abort")) {
      return { ok: false, error: `Tiempo de espera agotado (${config.timeoutMs} ms).` };
    }
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}
