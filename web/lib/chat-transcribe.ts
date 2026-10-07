import "server-only";
import { getEffectiveBlogBotApiKey } from "@/lib/blog-bot-store";
import { readChatAttachment } from "@/lib/chat-attachments";
import { listAllMessages, patchMessage } from "@/lib/host-inbox-store";
import type { HostInboxMessageRecord } from "@/lib/host-inbox-types";

/**
 * Transcripción de las notas de voz del chat. Se hace en segundo plano al llegar el audio y el texto
 * se guarda en el mensaje (`transcript`); al leer el chat se traduce igual que cualquier mensaje.
 */

const MODEL = () => process.env.CHAT_TRANSCRIBE_MODEL?.trim() || "gpt-4o-mini-transcribe";
const URL = () =>
  process.env.CHAT_TRANSCRIBE_URL?.trim() ||
  process.env.LISTING_IMPORT_OPENAI_URL?.trim()?.replace(/\/chat\/completions\/?$/, "/audio/transcriptions") ||
  "https://api.openai.com/v1/audio/transcriptions";
const MAX_TRANSCRIPT = 4_000;
const BACKFILL_DAYS = 60;
const BACKFILL_MAX = 60;

const inflight = new Set<string>();
const failedAt = new Map<string, number>();
const RETRY_AFTER_MS = 15 * 60_000;

export function transcriptionEnabled(): boolean {
  return Boolean(getEffectiveBlogBotApiKey());
}

export function needsTranscript(m: HostInboxMessageRecord): boolean {
  return m.attachment?.kind === "audio" && m.transcript === undefined;
}

async function transcribeFile(data: Buffer, mime: string, file: string): Promise<string | null> {
  const apiKey = getEffectiveBlogBotApiKey();
  if (!apiKey) return null;
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)], { type: mime }), file);
  form.append("model", MODEL());
  form.append("response_format", "json");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch(URL(), {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.warn("[chat transcribe] HTTP", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return null;
    }
    const j = (await res.json().catch(() => null)) as { text?: unknown } | null;
    return typeof j?.text === "string" ? j.text.trim().slice(0, MAX_TRANSCRIPT) : null;
  } finally {
    clearTimeout(timer);
  }
}

/** Transcribe una nota de voz y guarda el texto en el mensaje. Devuelve la transcripción o null. */
export async function transcribeMessage(m: HostInboxMessageRecord): Promise<string | null> {
  if (!needsTranscript(m) || !transcriptionEnabled() || inflight.has(m.id)) return null;
  if (Date.now() - (failedAt.get(m.id) ?? 0) < RETRY_AFTER_MS) return null;
  inflight.add(m.id);
  try {
    const a = m.attachment!;
    const file = await readChatAttachment(m.listingId, m.guestSessionId, a.file);
    if (!file) {
      failedAt.set(m.id, Date.now());
      return null;
    }
    const text = await transcribeFile(file.data, a.mime, a.file);
    if (text === null) {
      failedAt.set(m.id, Date.now());
      return null;
    }
    // Cadena vacía = audio sin palabras; se guarda para no volver a intentarlo.
    patchMessage(m.id, { transcript: text });
    return text;
  } catch (e) {
    failedAt.set(m.id, Date.now());
    console.warn("[chat transcribe]", m.id, e instanceof Error ? e.message : e);
    return null;
  } finally {
    inflight.delete(m.id);
  }
}

/** Dispara la transcripción sin esperar (al mandar el audio). */
export function scheduleTranscription(m: HostInboxMessageRecord): void {
  if (!needsTranscript(m)) return;
  void transcribeMessage(m);
}

/** Al arrancar: notas de voz recientes que todavía no tienen transcripción, de una en una. */
export async function backfillTranscripts(): Promise<number> {
  if (!transcriptionEnabled()) return 0;
  const since = Date.now() - BACKFILL_DAYS * 86_400_000;
  const pending = listAllMessages()
    .filter((m) => needsTranscript(m) && Date.parse(m.createdAt) > since)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, BACKFILL_MAX);
  let n = 0;
  for (const m of pending) {
    if ((await transcribeMessage(m)) !== null) n++;
  }
  return n;
}
