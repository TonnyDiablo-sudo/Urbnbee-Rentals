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
import { teamToolsLive } from "@/lib/team-access";
import { activeMembership, listTeamForHost } from "@/lib/team-store";
import { TEAM_CHAT_PREVIEW_ERROR, TOOL_PREVIEW_CODE } from "@/lib/tool-trial";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; status: number; code?: string };

export const TEAM_CHAT_NO_TEAM = "Invita a alguien a tu equipo para usar los chats de equipo.";

/** Escribir en los chats de equipo pide una herramienta en marcha (pagada o en prueba); verlos y armarlos, no. */
function chatPreviewBlock(hostId: string): Result | null {
  return teamToolsLive(hostId) ? null : { ok: false, error: TEAM_CHAT_PREVIEW_ERROR, status: 402, code: TOOL_PREVIEW_CODE };
}

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

/** El anfitrión y su equipo activo con cuenta: quienes pueden estar en un chat. */
function teamPeople(hostId: string): { id: string; name: string; host: boolean }[] {
  const out = [{ id: hostId, name: nameOf(hostId), host: true }];
  for (const m of listTeamForHost(hostId)) {
    if (m.status === "active" && m.userId && !out.some((p) => p.id === m.userId)) out.push({ id: m.userId, name: nameOf(m.userId), host: false });
  }
  return out;
}

function inChannel(c: TeamChannel, userId: string): boolean {
  if (c.pair) return userId === c.hostId || c.pair.includes(userId);
  return userId === c.hostId || !c.memberIds || c.memberIds.includes(userId);
}

/** Todos los que ven este chat. En uno a uno, sólo esas dos personas reciben avisos. */
function audience(channel: TeamChannel): string[] {
  if (channel.pair) return [...channel.pair];
  return teamPeople(channel.hostId)
    .map((p) => p.id)
    .filter((id) => inChannel(channel, id));
}

/** Lista válida de miembros (sin el anfitrión, que siempre está); `null` = todo el equipo. */
function cleanMembers(hostId: string, raw: unknown, creator: string): string[] | undefined | null {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "all") return null;
  if (!Array.isArray(raw)) return undefined;
  const valid = new Set(teamPeople(hostId).filter((p) => !p.host).map((p) => p.id));
  const ids = new Set(raw.filter((x): x is string => typeof x === "string" && valid.has(x)));
  if (creator !== hostId && valid.has(creator)) ids.add(creator);
  return [...ids];
}

/** En un chat de uno a uno se ve el nombre de la otra persona (el anfitrión ve a los dos). */
function directName(c: TeamChannel, viewer: string): string {
  const [a, b] = c.pair!;
  if (viewer === a) return nameOf(b);
  if (viewer === b) return nameOf(a);
  return `${nameOf(a)} · ${nameOf(b)}`;
}

function channelView(c: TeamChannel, viewer: string) {
  const last = listMessages(c.id, 1)[0];
  const members = c.pair ? [...c.pair] : audience(c);
  return {
    id: c.id,
    name: c.pair ? directName(c, viewer) : c.name,
    emoji: c.emoji,
    direct: Boolean(c.pair),
    createdBy: c.createdBy,
    lastAt: c.lastAt,
    everyone: !c.pair && !c.memberIds,
    memberIds: members,
    memberNames: members.map(nameOf),
    lastMine: last?.by === viewer,
    preview: last
      ? `${last.by === viewer || c.pair ? "" : `${nameOf(last.by)}: `}${last.body || (last.attachment ? attachmentLabel(last.attachment) : "")}`
      : "",
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

export function teamChannelsView(
  userId: string,
  hostId: string
): Result<{ channels: ReturnType<typeof channelView>[]; people: ReturnType<typeof teamPeople>; me: string; isHost: boolean; live: boolean }> {
  if (!teamChatActor(userId, hostId)) return { ok: false, error: TEAM_CHAT_NO_TEAM, status: 403 };
  return {
    ok: true,
    channels: listChannels(hostId)
      .filter((c) => inChannel(c, userId))
      .map((c) => channelView(c, userId)),
    people: teamPeople(hostId),
    me: userId,
    isHost: userId === hostId,
    /** false = vista previa: se ven y se arman los chats, pero nadie puede escribir hasta activar una herramienta. */
    live: teamToolsLive(hostId),
  };
}

function cleanName(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, 40) : "";
}

function cleanEmoji(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s ? Array.from(s).slice(0, 2).join("") : "💬";
}

export function createTeamChannel(
  userId: string,
  hostId: string,
  raw: { name?: unknown; emoji?: unknown; memberIds?: unknown; direct?: unknown }
): Result<{ id: string }> {
  if (!teamChatActor(userId, hostId)) return { ok: false, error: TEAM_CHAT_NO_TEAM, status: 403 };
  if (raw.direct !== undefined) return openDirect(userId, hostId, raw.direct);
  const name = cleanName(raw.name);
  if (!name) return { ok: false, error: "Ponle nombre al chat.", status: 400 };
  if (listChannels(hostId).filter((c) => !c.pair).length >= MAX_CHANNELS) {
    return { ok: false, error: `Máximo ${MAX_CHANNELS} chats de equipo.`, status: 409 };
  }
  const memberIds = cleanMembers(hostId, raw.memberIds, userId) ?? undefined;
  const c = addChannel({ hostId, name, emoji: cleanEmoji(raw.emoji), createdBy: userId, memberIds });
  if (memberIds) {
    for (const id of audience(c)) {
      if (id === userId) continue;
      notifyUser(id, {
        kind: "team",
        title: "Te agregaron al chat {chat}",
        body: "{name} te agregó a un chat de equipo.",
        vars: { chat: `${c.emoji} ${c.name}`, name: nameOf(userId) },
        url: chatUrl(id, c),
        tag: `team-chat:${c.id}`,
      });
    }
  }
  return { ok: true, id: c.id };
}

/** Chat de uno a uno con alguien del equipo (o el anfitrión); si ya existe, se abre ese. */
function openDirect(userId: string, hostId: string, raw: unknown): Result<{ id: string }> {
  const other = typeof raw === "string" ? raw : "";
  if (!other || other === userId || !teamPeople(hostId).some((p) => p.id === other)) {
    return { ok: false, error: "Esa persona no está en el equipo.", status: 400 };
  }
  const pair = [userId, other].sort() as [string, string];
  const found = listChannels(hostId).find((c) => c.pair && c.pair[0] === pair[0] && c.pair[1] === pair[1]);
  if (found) return { ok: true, id: found.id };
  const c = addChannel({ hostId, name: "Directo", emoji: "👤", createdBy: userId, pair });
  return { ok: true, id: c.id };
}

/** Los chats de equipo viven en Mensajes, pestaña «Colaboradores». */
function chatUrl(userId: string, channel: TeamChannel) {
  return `${userId === channel.hostId ? "/host/mensajes" : "/mensajes"}?tab=equipo&chat=${channel.id}`;
}

function channelFor(userId: string, channelId: string): { channel: TeamChannel; owner: boolean } | null {
  const channel = getChannel(channelId);
  if (!channel) return null;
  const actor = teamChatActor(userId, channel.hostId);
  return actor && inChannel(channel, userId) ? { channel, owner: actor.owner } : null;
}

export function editTeamChannel(userId: string, channelId: string, raw: { name?: unknown; emoji?: unknown; memberIds?: unknown }): Result {
  const c = channelFor(userId, channelId);
  if (!c) return { ok: false, error: "No encontrado.", status: 404 };
  if (c.channel.pair) return { ok: false, error: "Los chats de uno a uno no se editan.", status: 400 };
  if (!c.owner && c.channel.createdBy !== userId) return { ok: false, error: "Sólo quien lo creó o el anfitrión.", status: 403 };
  const patch: { name?: string; emoji?: string; memberIds?: string[] } = {};
  if (raw.name !== undefined) {
    const n = cleanName(raw.name);
    if (!n) return { ok: false, error: "Ponle nombre al chat.", status: 400 };
    patch.name = n;
  }
  if (raw.emoji !== undefined) patch.emoji = cleanEmoji(raw.emoji);
  const members = cleanMembers(c.channel.hostId, raw.memberIds, c.channel.createdBy);
  const before = new Set(audience(c.channel));
  if (members !== undefined) patch.memberIds = members ?? undefined;
  const next = updateChannel(channelId, patch);
  if (next && members !== undefined) {
    for (const id of audience(next)) {
      if (before.has(id) || id === userId) continue;
      notifyUser(id, {
        kind: "team",
        title: "Te agregaron al chat {chat}",
        body: "{name} te agregó a un chat de equipo.",
        vars: { chat: `${next.emoji} ${next.name}`, name: nameOf(userId) },
        url: chatUrl(id, next),
        tag: `team-chat:${next.id}`,
      });
    }
  }
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
    channel: channelView(c.channel, userId),
    canManage: !c.channel.pair && (c.owner || c.channel.createdBy === userId),
    isHost: c.owner,
    live: teamToolsLive(c.channel.hostId),
    people: teamPeople(c.channel.hostId),
    messages: listMessages(channelId).map((m) => messageView(m, userId)),
  };
}

function announce(channel: TeamChannel, from: string, text: string) {
  const who = nameOf(from);
  for (const id of audience(channel)) {
    if (id === from) continue;
    notifyUser(id, {
      kind: "team",
      title: channel.pair ? `👤 ${who}` : `${channel.emoji} ${channel.name}`,
      body: (channel.pair ? text : `${who}: ${text}`).slice(0, 160),
      rawBody: true,
      url: chatUrl(id, channel),
      tag: `team-chat:${channel.id}`,
    });
  }
}

export function postTeamText(userId: string, channelId: string, raw: unknown): Result {
  const c = channelFor(userId, channelId);
  if (!c) return { ok: false, error: "No encontrado.", status: 404 };
  const preview = chatPreviewBlock(c.channel.hostId);
  if (preview) return preview;
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
  const preview = chatPreviewBlock(c.channel.hostId);
  if (preview) return preview;
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
