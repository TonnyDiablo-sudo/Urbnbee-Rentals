import "server-only";
import { getEffectiveBlogBotApiKey } from "@/lib/blog-bot-store";
import {
  actionUsageFromOpenAi,
  type ListingImportActionUsage,
  type ListingImportUsageSummary,
  appendAction,
  emptyUsageSummary,
} from "@/lib/listing-import-usage";

export type OpenAiChatUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type OpenAiImagePart = { mime: string; base64: string };

export type OpenAiChatResult<T> =
  | {
      ok: true;
      data: T;
      usage: OpenAiChatUsage;
      model: string;
      rawText: string;
    }
  | { ok: false; error: string; detail?: string };

export function getListingImportModel(): string {
  return (
    process.env.LISTING_IMPORT_OPENAI_MODEL?.trim() ||
    process.env.BLOG_BOT_OPENAI_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

/** Modelo para el panel de asociados: el más listo disponible, el volumen es bajo. */
export function getAssociateImportModel(): string {
  return process.env.ASSOCIATE_IMPORT_OPENAI_MODEL?.trim() || "gpt-6-astra";
}

/** Respaldo si la cuenta de OpenAI todavía no tiene acceso al modelo del panel de asociados. */
export const ASSOCIATE_FALLBACK_MODEL = "gpt-5";

/** Los modelos de razonamiento rechazan `temperature` y `max_tokens`. */
function isReasoningModel(model: string): boolean {
  return /^(gpt-[5-9]|o\d)/i.test(model);
}

/** `original` (resolución completa, mejor para leer letra chica en capturas) sólo existe desde gpt-5.4. */
function supportsOriginalDetail(model: string): boolean {
  return /^gpt-(5\.([4-9]|\d{2,})|[6-9])/i.test(model);
}

/** GPT-6 ya no acepta `minimal`. */
function effortFor(model: string, effort: string): string {
  return effort === "minimal" && /^gpt-([6-9])/i.test(model) ? "low" : effort;
}

export function getListingImportOpenAiUrl(): string {
  return (
    process.env.LISTING_IMPORT_OPENAI_URL?.trim() || "https://api.openai.com/v1/chat/completions"
  );
}

function stripJsonFence(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "");
    s = s.replace(/\s*```\s*$/i, "");
  }
  return s.trim();
}

type OpenAiJsonOpts = {
  system: string;
  userText: string;
  images?: OpenAiImagePart[];
  maxTokens?: number;
  timeoutMs?: number;
  imageDetail?: "low" | "high" | "auto" | "original";
  model?: string;
  /** Se usa si la cuenta todavía no tiene acceso a `model`. */
  fallbackModel?: string;
  /** PDFs u otros documentos (sólo modelos con visión). */
  files?: { filename: string; mime: string; base64: string }[];
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
};

const MODEL_UNAVAILABLE = /model.*(does not exist|not found|not supported|not available)|do(es)? not have access|model_not_found/i;

export async function callListingImportOpenAiJson<T>(opts: OpenAiJsonOpts): Promise<OpenAiChatResult<T>> {
  const first = await callOnce<T>(opts);
  if (first.ok || !opts.fallbackModel || opts.fallbackModel === opts.model || !MODEL_UNAVAILABLE.test(first.error)) {
    return first;
  }
  return callOnce<T>({ ...opts, model: opts.fallbackModel });
}

async function callOnce<T>(opts: OpenAiJsonOpts): Promise<OpenAiChatResult<T>> {
  const apiKey = getEffectiveBlogBotApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error:
        "No hay API key de OpenAI configurada (OPENAI_API_KEY o BLOG_BOT_OPENAI_API_KEY en Railway).",
    };
  }

  const model = opts.model ?? getListingImportModel();
  const url = getListingImportOpenAiUrl();
  const reasoning = isReasoningModel(model);

  const userParts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" | "original" } }
    | { type: "file"; file: { filename: string; file_data: string } }
  > = [{ type: "text", text: opts.userText }];
  for (const f of opts.files ?? []) {
    userParts.push({ type: "file", file: { filename: f.filename, file_data: `data:${f.mime};base64,${f.base64}` } });
  }

  const wanted = opts.imageDetail ?? "high";
  const detail = wanted === "original" && !supportsOriginalDetail(model) ? "high" : wanted;
  for (const img of opts.images ?? []) {
    userParts.push({
      type: "image_url",
      image_url: { url: `data:${img.mime};base64,${img.base64}`, detail },
    });
  }

  const controller = new AbortController();
  const envTimeout = Number(process.env.LISTING_IMPORT_TIMEOUT_MS);
  const defaultTimeout = Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : 90_000;
  const timeoutMs = Math.min(300_000, Math.max(15_000, opts.timeoutMs ?? defaultTimeout));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: userParts },
        ],
        ...(reasoning
          ? {
              max_completion_tokens: Math.max(16_000, opts.maxTokens ?? 0),
              reasoning_effort: effortFor(
                model,
                opts.reasoningEffort ?? (process.env.ASSOCIATE_IMPORT_REASONING_EFFORT?.trim() || "medium")
              ),
            }
          : { temperature: 0.2, max_tokens: opts.maxTokens ?? 2500 }),
        response_format: { type: "json_object" },
      }),
    });

    const data = (await res.json()) as {
      error?: { message?: string };
      usage?: OpenAiChatUsage;
      choices?: Array<{ message?: { content?: string } }>;
    };

    if (!res.ok) {
      return { ok: false, error: data.error?.message ?? `OpenAI HTTP ${res.status}` };
    }

    const rawText = data.choices?.[0]?.message?.content?.trim();
    if (!rawText) return { ok: false, error: "El modelo no devolvió contenido." };

    let parsed: T;
    try {
      parsed = JSON.parse(stripJsonFence(rawText)) as T;
    } catch {
      return { ok: false, error: "La respuesta no es JSON válido.", detail: rawText.slice(0, 500) };
    }

    return {
      ok: true,
      data: parsed,
      usage: data.usage ?? {},
      model,
      rawText,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("abort")) {
      return { ok: false, error: "La operación tardó demasiado. Prueba con menos capturas." };
    }
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

export function usageToAction(
  summary: ListingImportUsageSummary,
  opts: {
    action: ListingImportActionUsage["action"];
    label: string;
    model: string;
    usage: OpenAiChatUsage;
  }
): ListingImportUsageSummary {
  const action = actionUsageFromOpenAi({
    action: opts.action,
    label: opts.label,
    model: opts.model,
    promptTokens: opts.usage.prompt_tokens ?? 0,
    completionTokens: opts.usage.completion_tokens ?? 0,
  });
  return appendAction(summary, action);
}

export { emptyUsageSummary };
