import "server-only";
import { randomBytes } from "crypto";
import sharp from "sharp";
import type { ChatAttachment, ChatAttachmentView, HostInboxMessageRecord } from "@/lib/host-inbox-types";
import { getPrivateFile, putPrivateFile } from "@/lib/private-files";
import { getListingById } from "@/lib/marketplace-store";
import { guestSessionIdForUser } from "@/lib/host-inbox-store";
import { memberCan } from "@/lib/team-access";

export const CHAT_IMAGE_MAX_BYTES = 12 * 1024 * 1024;
export const CHAT_AUDIO_MAX_BYTES = 6 * 1024 * 1024;
export const CHAT_AUDIO_MAX_SEC = 180;

/** MediaRecorder graba audio/webm en Chrome/Android y audio/mp4 en Safari/iPhone. */
const AUDIO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};
const EXT_MIME: Record<string, string> = {
  webp: "image/webp",
  webm: "audio/webm",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

const SEGMENT = /^[A-Za-z0-9_-]{1,100}$/;
const FILE = /^[a-f0-9]{24}\.(webp|webm|ogg|m4a|aac|mp3|wav)$/;

function keyOf(listingId: string, guestSessionId: string, file: string): string {
  if (!SEGMENT.test(listingId) || !SEGMENT.test(guestSessionId) || !FILE.test(file)) throw new Error("bad key");
  return `chat/${listingId}/${guestSessionId}/${file}`;
}

export function attachmentUrl(listingId: string, guestSessionId: string, a: ChatAttachment): string {
  return `/api/chat/attachments/${encodeURIComponent(listingId)}/${encodeURIComponent(guestSessionId)}/${a.file}`;
}

export function attachmentView(m: Pick<HostInboxMessageRecord, "listingId" | "guestSessionId" | "attachment">): ChatAttachmentView | undefined {
  const a = m.attachment;
  if (!a) return undefined;
  return {
    url: attachmentUrl(m.listingId, m.guestSessionId, a),
    kind: a.kind,
    durationSec: a.durationSec,
    width: a.width,
    height: a.height,
  };
}

/** Lo que se muestra en avisos y en la lista de chats cuando el mensaje es sólo un adjunto. */
export function attachmentPreview(kind: ChatAttachment["kind"]): string {
  return kind === "image" ? "📷 Foto" : "🎤 Nota de voz";
}

function baseMime(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}

/** Las fotos se reducen y se pasan a WebP sin EXIF (no viaja la ubicación GPS del celular). */
export async function storeChatAttachment(opts: {
  listingId: string;
  guestSessionId: string;
  data: Buffer;
  mime: string;
  durationSec?: number;
}): Promise<{ attachment?: ChatAttachment; error?: string }> {
  const mime = baseMime(opts.mime);
  const id = randomBytes(12).toString("hex");
  if (mime.startsWith("image/")) {
    if (opts.data.byteLength > CHAT_IMAGE_MAX_BYTES) return { error: "La foto pesa demasiado (máximo 12 MB)." };
    let out: { data: Buffer; info: sharp.OutputInfo };
    try {
      out = await sharp(opts.data, { failOn: "error" })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 74 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      return { error: "No pudimos leer esa imagen. Prueba con una foto JPG o PNG." };
    }
    const file = `${id}.webp`;
    await putPrivateFile(keyOf(opts.listingId, opts.guestSessionId, file), out.data, "image/webp");
    return {
      attachment: { file, kind: "image", mime: "image/webp", bytes: out.data.byteLength, width: out.info.width, height: out.info.height },
    };
  }
  const ext = AUDIO_EXT[mime];
  if (!ext) return { error: "Sólo se pueden mandar fotos y notas de voz." };
  if (opts.data.byteLength > CHAT_AUDIO_MAX_BYTES) return { error: "La nota de voz es muy larga (máximo 3 minutos)." };
  if (opts.data.byteLength < 200) return { error: "La nota de voz quedó vacía. Intenta de nuevo." };
  const file = `${id}.${ext}`;
  await putPrivateFile(keyOf(opts.listingId, opts.guestSessionId, file), opts.data, mime);
  const dur = Number(opts.durationSec);
  return {
    attachment: {
      file,
      kind: "audio",
      mime,
      bytes: opts.data.byteLength,
      durationSec: Number.isFinite(dur) && dur > 0 ? Math.min(CHAT_AUDIO_MAX_SEC, Math.round(dur)) : undefined,
    },
  };
}

export async function readChatAttachment(
  listingId: string,
  guestSessionId: string,
  file: string
): Promise<{ data: Buffer; mime: string } | null> {
  let key: string;
  try {
    key = keyOf(listingId, guestSessionId, file);
  } catch {
    return null;
  }
  const data = await getPrivateFile(key);
  if (!data) return null;
  return { data, mime: EXT_MIME[file.split(".").pop() ?? ""] ?? "application/octet-stream" };
}

/** Sólo el huésped de ese hilo y quien atiende los mensajes del anuncio pueden ver los adjuntos. */
export function canSeeChatThread(userId: string, listingId: string, guestSessionId: string): boolean {
  if (guestSessionIdForUser(userId) === guestSessionId) return true;
  const listing = getListingById(listingId);
  if (!listing) return false;
  return listing.hostId === userId || Boolean(memberCan(userId, listing.hostId, "messages", listing.id));
}
