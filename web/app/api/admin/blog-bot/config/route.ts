import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import {
  getBlogBotConfig,
  patchBlogBotConfig,
  maskApiKeyHint,
  hasStoredApiKey,
  getEffectiveBlogBotApiKey,
} from "@/lib/blog-bot-store";

function safeConfig() {
  const c = getBlogBotConfig();
  const envKey =
    Boolean(process.env.BLOG_BOT_OPENAI_API_KEY?.trim()) ||
    Boolean(process.env.OPENAI_API_KEY?.trim());
  const effective = getEffectiveBlogBotApiKey();
  return {
    ...c,
    apiKeyFromEnv: envKey,
    apiKeyEffectivePresent: Boolean(effective),
    storedApiKeyMasked: maskApiKeyHint(),
    hasStoredApiKey: hasStoredApiKey(),
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(safeConfig());
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    enabled?: boolean;
    apiBaseUrl?: string;
    chatCompletionsUrl?: string | null;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPromptAppend?: string;
    brandKeywords?: string;
    timeoutMs?: number;
    topics?: string[];
    scheduleEnabled?: boolean;
    scheduleTimezone?: string;
    scheduleDaysOfWeek?: number[];
    scheduleTimeLocal?: string;
    apiKey?: string | null;
    clearStoredApiKey?: boolean;
  };

  const patch: Parameters<typeof patchBlogBotConfig>[0] = {};

  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.apiBaseUrl === "string") patch.apiBaseUrl = body.apiBaseUrl.trim();
  if (body.chatCompletionsUrl === null) patch.chatCompletionsUrl = undefined;
  else if (typeof body.chatCompletionsUrl === "string") {
    const u = body.chatCompletionsUrl.trim();
    patch.chatCompletionsUrl = u || undefined;
  }
  if (typeof body.model === "string") patch.model = body.model.trim();
  if (typeof body.temperature === "number" && !Number.isNaN(body.temperature)) {
    patch.temperature = Math.min(2, Math.max(0, body.temperature));
  }
  if (typeof body.maxTokens === "number" && body.maxTokens >= 256 && body.maxTokens <= 16000) {
    patch.maxTokens = Math.floor(body.maxTokens);
  }
  if (typeof body.systemPromptAppend === "string") patch.systemPromptAppend = body.systemPromptAppend;
  if (typeof body.brandKeywords === "string") patch.brandKeywords = body.brandKeywords;
  if (typeof body.timeoutMs === "number" && body.timeoutMs >= 5000 && body.timeoutMs <= 600000) {
    patch.timeoutMs = Math.floor(body.timeoutMs);
  }
  if (Array.isArray(body.topics)) {
    patch.topics = body.topics.map((t) => String(t).trim()).filter(Boolean);
  }
  if (typeof body.scheduleEnabled === "boolean") patch.scheduleEnabled = body.scheduleEnabled;
  if (typeof body.scheduleTimezone === "string") patch.scheduleTimezone = body.scheduleTimezone.trim();
  if (Array.isArray(body.scheduleDaysOfWeek)) {
    patch.scheduleDaysOfWeek = body.scheduleDaysOfWeek
      .map((n) => Number(n))
      .filter((d) => d >= 0 && d <= 6);
  }
  if (typeof body.scheduleTimeLocal === "string") patch.scheduleTimeLocal = body.scheduleTimeLocal.trim();

  let apiKeyOpt: { apiKey?: string | null } | undefined;
  if (body.clearStoredApiKey) {
    apiKeyOpt = { apiKey: null };
  } else if (typeof body.apiKey === "string" && body.apiKey.trim()) {
    apiKeyOpt = { apiKey: body.apiKey.trim() };
  }

  patchBlogBotConfig(patch, apiKeyOpt);

  return NextResponse.json(safeConfig());
}
