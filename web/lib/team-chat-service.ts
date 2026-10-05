import "server-only";
import { randomBytes } from "crypto";
import { publicNameOf } from "@/lib/display-name";
import { findUserById } from "@/lib/marketplace-store";
import { compressPhoto, deletePrivateFile, getPrivateFile, putPrivateFile } from "@/lib/private-files";
import { notifyUser } from "@/lib/push";
import {
  addChannel,
  addMessage,
  deleteChannel,
  deleteMessage,
  getChannel,
  getMessage,
  listChannels,
  listMessages,
  updateChannel,
  type TeamChannel,
  type TeamChatAttachment,
  type TeamChatMessage,
} from "@/lib/team-chat-store";
import { activeMembership, listTeamForHost } from "@/lib/team-store";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; status: number };

export const TEAM_CHAT_NO_TEAM = "Invita a alguien a tu equipo para usar los chats de equipo.";

const MAX_CHANNELS = 30;
const AUDIO_MAX_BYTES = 6 * 1024 * 1024;
const FILE_MAX_BYTES = 10 * 1024 * 1024;

/** El anfitrión (si tiene equipo) o alguien activo de su equipo. Es gratis: no depende de lo que se pague. */
export function teamChatActor(userId: string, hostId: string): { owner: boolean } | null {
  if (userId === hostId) {
    return listTeamForHost(hostId).some((m) => m.status === "active") ? { owner: true } : null;
  }
  return activeMembership(userId, hostId) ? { owner: false } : null;
}

function nameOf(userId: string): string {
  const u = findUserById(userId);
  return (u && publicNameOf(u)) || u?.email || "—";
}

/** Todos los que ven los chats de este anfitrión. */
function audience(hostId: string): string[] {
  const ids = new Set([hostId]);
  for (const m of listTeamForHost(hostId)) if (m.status === "active" && m.userId) ids.add(m.userId);
  return [...ids];
}

function channelView(c: TeamChannel) {
  const last = listMessages(c.id, 1)[0];
  return {
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    createdBy: c.createdBy,
    lastAt: c.lastAt,
    preview: last ? `${nameOf(last.by)}: ${last.body || (last.attachment ? attachmentLabel(last.attachment) : "")}` : "",
  };
}

function attachmentLabel(a: TeamChatAttachment) {
  return a.kind === "image" ? "📷 Foto" : a.kind === "audio" ? "🎤 Audio" : `📎 ${a.name || "Archivo"}`;
}

function messageView(m: TeamChatMessage, me: string) {
  return {
    id: m.id,
    by: m.by,
    byName: nameOf(m.by),
    mine: m.by === me,
    body: m.body ?? "",
    at: m.at,
    attachment: m.attachment
      ? {
          kind: m.attachment.kind,
          name: m.attachment.name,
          size: m.attachment.size,
          durationSec: m.attachment.durationSec,
          url: `/api/team-chat/${m.channelId}/files/${m.id}`,
        }
      : undefined,
  };
}

export function teamChannelsView(userId: string, hostId: string): Result<{ channels: ReturnType<typeof channelView>[] }> {
  if (!teamChatActor(userId, hostId)) return { ok: false, error: TEAM_CHAT_NO_TEAM, status: 403 };
  return { ok: true, channels: listChannels(hostId).map(channelView) };
}

function cleanName(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, 40) : "";
}

function cleanEmoji(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s ? Array.from(s).slice(0, 2).join("") : "💬";
}

export function createTeamChannel(userId: string, hostId: string, raw: { name?: unknown; emoji?: unknown }): Result<{ id: string }> {
  if (!teamChatActor(userId, hostId)) return { ok: false, error: TEAM_CHAT_NO_TEAM, status: 403 };
  const name = cleanName(raw.name);
  if (!name) return { ok: false, error: "Ponle nombre al chat.", status: 400 };
  if (listChannels(hostId).length >= MAX_CHANNELS) {
    return { ok: false, error: `Máximo ${MAX_CHANNELS} chats de equipo.`, status: 409 };
  }
  const c = addChannel({ hostId, name, emoji: cleanEmoji(raw.emoji), createdBy: userId });
  return { ok: true, id: c.id };
}

function channelFor(userId: string, channelId: string): { channel: TeamChannel; owner: boolean } | null {
  const channel = getChannel(channelId);
  if (!channel) return null;
  const actor = teamChatActor(userId, channel.hostId);
  return actor ? { channel, owner: actor.owner } : null;
}

export function editTeamChannel(userId: string, channelId: string, raw: { name?: unknown; emoji?: unknown }): Result {
  const c = channelFor(userId, channelId);
  if (!c) return { ok: false, error: "No encontrado.", status: 404 };
  if (!c.owner && c.channel.createdBy !== userId) return { ok: false, error: "Sólo quien lo creó o el anfitrión.", status: 403 };
  const patch: { name?: string; emoji?: string } = {};
  if (raw.name !== undefined) {
    const n = cleanName(raw.name);
    if (!n) return { ok: false, error: "Ponle nombre al chat.", status: 400 };
    patch.name = n;
  }
  if (raw.emoji !== undefined) patch.emoji = cleanEmoji(raw.emoji);
  updateChannel(channelId, patch);
  return { ok: true };
}

export async function removeTeamChannel(userId: string, channelId: string): Promise<Result> {
  const c = channelFor(userId, channelId);
  if (!c) return { ok: false, error: "No encontrado.", status: 404 };
  if (!c.owner && c.channel.createdBy !== userId) return { ok: false, error: "Sólo quien lo creó o el anfitrión.", status: 403 };
  for (const a of deleteChannel(channelId)) await deletePrivateFile(a.key);
  return { ok: true };
}

export function teamMessagesView(userId: string, channelId: string) {
  const c = channelFor(userId, channelId);
  if (!c) return null;
  return {
    channel: { id: c.channel.id, name: c.channel.name, emoji: c.channel.emoji },
    canManage: c.owner || c.channel.createdBy === userId,
    messages: listMessages(channelId).map((m) => messageView(m, userId)),
  };
}

function announce(channel: TeamChannel, from: string, text: string) {
  const who = nameOf(from);
  for (const id of audience(channel.hostId)) {
    if (id === from) continue;
    notifyUser(id, {
      kind: "team",
      title: `${channel.emoji} ${channel.name}`,
      body: `${who}: ${text}`.slice(0, 160),
      rawBody: true,
      url: id === channel.hostId ? `/host/colaboradores?chat=${channel.id}` : `/equipo?chat=${channel.id}`,
      tag: `team-chat:${channel.id}`,
    });
  }
}

export function postTeamText(userId: string, channelId: string, raw: unknown): Result {
  const c = channelFor(userId, channelId);
  if (!c) return { ok: false, error: "No encontrado.", status: 404 };
  const body = typeof raw === "string" ? raw.trim().slice(0, 4000) : "";
  if (!body) return { ok: false, error: "Escribe un mensaje.", status: 400 };
  addMessage({ channelId, hostId: c.channel.hostId, by: userId, body });
  announce(c.channel, userId, body);
  return { ok: true };
}

export async function postTeamFile(
  userId: string,
  channelId: string,
  file: { buf: Buffer; mime: string; name: string },
  extra: { caption?: string; durationSec?: number }
): Promise<Result> {
  const c = channelFor(userId, channelId);
  if (!c) return { ok: false, error: "No encontrado.", status: 404 };
  const id = randomBytes(8).toString("hex");
  const base = `team-chat/${c.channel.hostId}/${channelId}/${id}`;
  let attachment: TeamChatAttachment;
  if (file.mime.startsWith("image/")) {
    let webp: Buffer;
    try {
      webp = await compressPhoto(file.buf);
    } catch {
      return { ok: false, error: "No se pudo leer la foto. Usa JPG, PNG o HEIC de menos de 10 MB.", status: 400 };
    }
    attachment = { kind: "image", key: `${base}.webp`, mime: "image/webp", size: webp.length };
    await putPrivateFile(attachment.key, webp, attachment.mime);
  } else if (file.mime.startsWith("audio/")) {
    if (file.buf.length > AUDIO_MAX_BYTES) return { ok: false, error: "El audio pesa más de 6 MB.", status: 413 };
    const ext = file.mime.includes("mp4") || file.mime.includes("aac") ? "m4a" : file.mime.includes("ogg") ? "ogg" : "webm";
    attachment = {
      kind: "audio",
      key: `${base}.${ext}`,
      mime: file.mime.split(";")[0],
      size: file.buf.length,
      durationSec: extra.durationSec && extra.durationSec > 0 ? Math.min(600, Math.round(extra.durationSec)) : undefined,
    };
    await putPrivateFile(attachment.key, file.buf, attachment.mime);
  } else {
    if (file.buf.length > FILE_MAX_BYTES) return { ok: false, error: "El archivo pesa más de 10 MB.", status: 413 };
    const name = file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 80) || "archivo";
    attachment = { kind: "file", key: `${base}.bin`, mime: "application/octet-stream", size: file.buf.length, name };
    await putPrivateFile(attachment.key, file.buf, attachment.mime);
  }
  const caption = extra.caption?.trim().slice(0, 1000) || undefined;
  addMessage({ channelId, hostId: c.channel.hostId, by: userId, body: caption, attachment });
  announce(c.channel, userId, caption || attachmentLabel(attachment));
  return { ok: true };
}

export async function readTeamFile(userId: string, channelId: string, messageId: string) {
  const m = getMessage(messageId);
  if (!m?.attachment || m.channelId !== channelId || !channelFor(userId, channelId)) return null;
  const buf = await getPrivateFile(m.attachment.key);
  return buf ? { buf, attachment: m.attachment } : null;
}

/** Cada quien borra lo suyo; el anfitrión puede borrar cualquier mensaje. */
export async function removeTeamMessage(userId: string, channelId: string, messageId: string): Promise<Result> {
  const c = channelFor(userId, channelId);
  const m = getMessage(messageId);
  if (!c || !m || m.channelId !== channelId) return { ok: false, error: "No encontrado.", status: 404 };
  if (!c.owner && m.by !== userId) return { ok: false, error: "No autorizado.", status: 403 };
  deleteMessage(messageId);
  if (m.attachment) await deletePrivateFile(m.attachment.key);
  return { ok: true };
}
