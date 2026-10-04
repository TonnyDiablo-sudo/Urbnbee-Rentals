import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { getBeeagentAgentStatus } from "@/lib/beeagent-agent-status";
import { getBeeagentLinkForHost } from "@/lib/beeagent-host-link-store";
import { botCan } from "@/lib/beeagent-permissions";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

type ConversationAi = { enabled: boolean; updatedAt: string; by: "host" | "urbnbeeai" };
/** urbnbeeai avisa que ya recibe el chat de Cabibee en su central; hasta entonces la IA empieza apagada. */
type ChannelState = { enabled: boolean; updatedAt: string };

export type ChatAiState = {
  /** El anfitrión tiene urbnbeeai vinculado y su agente activo. */
  available: boolean;
  /** La IA contesta en esta conversación. */
  enabled: boolean;
  updatedAt: string | null;
};

const DATA_FILE = join(getDataDir(), "chat-ai-settings.json");
let conversations: Record<string, ConversationAi> = {};
let channels: Record<string, ChannelState> = {};
let cachedMtimeMs = 0;

function load() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as {
      conversations?: Record<string, ConversationAi>;
      channels?: Record<string, ChannelState>;
    };
    conversations = data.conversations && typeof data.conversations === "object" ? data.conversations : {};
    channels = data.channels && typeof data.channels === "object" ? data.channels : {};
    cachedMtimeMs = m;
  } catch (e) {
    console.warn("[chat-ai] load failed:", e);
  }
}

function persist() {
  try {
    ensureDir(getDataDir());
    const snapshot = { version: 1 as const, conversations, channels };
    writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("chat-ai-settings", snapshot));
  } catch (e) {
    console.warn("[chat-ai] persist failed:", e);
  }
}

load();

/** Clave de la conversación en urbnbeeai. */
export function cabibeeConversationKey(listingId: string, guestSessionId: string): string {
  return `cabibee:${listingId}:${guestSessionId}`;
}

export function parseCabibeeConversationKey(key: string): { listingId: string; guestSessionId: string } | null {
  const m = /^cabibee:([^:]+):([^:]+)$/.exec(key.trim());
  return m ? { listingId: m[1], guestSessionId: m[2] } : null;
}

export function chatAiAvailable(hostId: string): boolean {
  return Boolean(getBeeagentLinkForHost(hostId) && getBeeagentAgentStatus(hostId)?.active && botCan(hostId, "messages"));
}

export function chatChannelReady(hostId: string): boolean {
  load();
  return channels[hostId]?.enabled === true;
}

export function getChatChannel(hostId: string): ChannelState | null {
  load();
  return channels[hostId] ?? null;
}

export function setChatChannel(hostId: string, enabled: boolean): ChannelState {
  load();
  channels[hostId] = { enabled, updatedAt: new Date().toISOString() };
  persist();
  return channels[hostId];
}

export function getChatAi(hostId: string, listingId: string, guestSessionId: string): ChatAiState {
  load();
  const available = chatAiAvailable(hostId);
  const row = conversations[cabibeeConversationKey(listingId, guestSessionId)];
  const enabled = available && (row ? row.enabled : chatChannelReady(hostId));
  return { available, enabled, updatedAt: row?.updatedAt ?? null };
}

export type SetChatAiResult = { ok: true; state: ChatAiState } | { ok: false; reason: "unavailable" | "conflict"; state: ChatAiState };

/** `ifMatchUpdatedAt` evita pisar un cambio más nuevo del otro lado. */
export function setChatAi(input: {
  hostId: string;
  listingId: string;
  guestSessionId: string;
  enabled: boolean;
  by: ConversationAi["by"];
  ifMatchUpdatedAt?: string | null;
}): SetChatAiResult {
  load();
  const current = getChatAi(input.hostId, input.listingId, input.guestSessionId);
  if (!current.available) return { ok: false, reason: "unavailable", state: current };
  if (input.ifMatchUpdatedAt !== undefined && input.ifMatchUpdatedAt !== current.updatedAt) {
    return { ok: false, reason: "conflict", state: current };
  }
  const key = cabibeeConversationKey(input.listingId, input.guestSessionId);
  let updatedAt = new Date().toISOString();
  if (current.updatedAt && updatedAt <= current.updatedAt) updatedAt = new Date(Date.parse(current.updatedAt) + 1).toISOString();
  conversations[key] = { enabled: input.enabled, updatedAt, by: input.by };
  persist();
  return { ok: true, state: getChatAi(input.hostId, input.listingId, input.guestSessionId) };
}
