import "server-only";
import { randomBytes } from "crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

export type TeamChannel = {
  id: string;
  hostId: string;
  name: string;
  emoji: string;
  createdBy: string;
  createdAt: string;
  lastAt: string;
};

export type TeamChatAttachment = {
  kind: "image" | "audio" | "file";
  key: string;
  mime: string;
  size: number;
  name?: string;
  durationSec?: number;
};

export type TeamChatMessage = {
  id: string;
  channelId: string;
  hostId: string;
  /** Cuenta que lo mandó. */
  by: string;
  body?: string;
  attachment?: TeamChatAttachment;
  at: string;
};

const DATA_FILE = join(getDataDir(), "team-chats.json");
let channels: TeamChannel[] = [];
let messages: TeamChatMessage[] = [];
let cachedMtimeMs = 0;

function load() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { channels?: TeamChannel[]; messages?: TeamChatMessage[] };
    channels = Array.isArray(data.channels) ? data.channels : [];
    messages = Array.isArray(data.messages) ? data.messages : [];
    cachedMtimeMs = m;
  } catch (e) {
    console.warn("[team-chat] load failed:", e);
  }
}

function persist() {
  try {
    ensureDir(getDataDir());
    const snapshot = { version: 1 as const, channels, messages };
    writeFileSync(DATA_FILE, JSON.stringify(snapshot), "utf8");
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("team-chats", snapshot));
  } catch (e) {
    console.warn("[team-chat] persist failed:", e);
  }
}

load();

export function listChannels(hostId: string): TeamChannel[] {
  load();
  return channels.filter((c) => c.hostId === hostId).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export function getChannel(id: string): TeamChannel | undefined {
  load();
  return channels.find((c) => c.id === id);
}

export function addChannel(input: { hostId: string; name: string; emoji: string; createdBy: string }): TeamChannel {
  load();
  const now = new Date().toISOString();
  const c: TeamChannel = { ...input, id: `tc_${randomBytes(8).toString("hex")}`, createdAt: now, lastAt: now };
  channels.push(c);
  persist();
  return c;
}

export function updateChannel(id: string, patch: Partial<Pick<TeamChannel, "name" | "emoji">>): TeamChannel | undefined {
  load();
  const i = channels.findIndex((c) => c.id === id);
  if (i === -1) return undefined;
  channels[i] = { ...channels[i], ...patch };
  persist();
  return channels[i];
}

/** Borra el chat y devuelve los archivos que quedaron sin dueño. */
export function deleteChannel(id: string): TeamChatAttachment[] {
  load();
  const files = messages.filter((m) => m.channelId === id && m.attachment).map((m) => m.attachment!);
  channels = channels.filter((c) => c.id !== id);
  messages = messages.filter((m) => m.channelId !== id);
  persist();
  return files;
}

export function listMessages(channelId: string, limit = 200): TeamChatMessage[] {
  load();
  return messages.filter((m) => m.channelId === channelId).slice(-limit);
}

export function getMessage(id: string): TeamChatMessage | undefined {
  load();
  return messages.find((m) => m.id === id);
}

export function addMessage(input: Omit<TeamChatMessage, "id" | "at">): TeamChatMessage {
  load();
  const msg: TeamChatMessage = { ...input, id: `tm_${randomBytes(9).toString("hex")}`, at: new Date().toISOString() };
  messages.push(msg);
  const c = channels.find((x) => x.id === input.channelId);
  if (c) c.lastAt = msg.at;
  persist();
  return msg;
}

export function deleteMessage(id: string): TeamChatMessage | undefined {
  load();
  const m = messages.find((x) => x.id === id);
  if (!m) return undefined;
  messages = messages.filter((x) => x.id !== id);
  persist();
  return m;
}
