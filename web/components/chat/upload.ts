"use client";

/** Sube una foto o nota de voz al chat; devuelve el error en texto o null si salió bien. */
export async function uploadChatAttachment(
  file: Blob,
  opts: { listingId: string; as: "guest" | "host"; guestSessionId?: string; caption: string; durationSec?: number }
): Promise<string | null> {
  const form = new FormData();
  const ext = file.type.startsWith("image/") ? "jpg" : file.type.includes("mp4") ? "m4a" : "webm";
  form.append("file", file, `chat.${ext}`);
  form.append("listingId", opts.listingId);
  form.append("as", opts.as);
  if (opts.guestSessionId) form.append("guestSessionId", opts.guestSessionId);
  if (opts.caption) form.append("caption", opts.caption);
  if (opts.durationSec) form.append("durationSec", String(opts.durationSec));
  try {
    const res = await fetch("/api/chat/attachments", { method: "POST", body: form });
    if (res.ok) return null;
    const j = await res.json().catch(() => ({}));
    return typeof j.error === "string" ? j.error : "No se pudo enviar.";
  } catch {
    return "Sin conexión.";
  }
}
