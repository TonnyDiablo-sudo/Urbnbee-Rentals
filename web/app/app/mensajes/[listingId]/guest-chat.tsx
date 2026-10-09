"use client";

import Link from "next/link";
import { useCallback } from "react";
import { VerifyEmailBox } from "@/components/account/purchase-prereqs";
import { useT } from "@/components/i18n-provider";
import { uploadChatAttachment } from "@/components/chat/upload";
import { BlockUserButton } from "../../_components/block-user";
import { ChatThread, type ChatMessage, type SendMeta } from "../../_components/chat-thread";

export function GuestChat({
  listingId,
  title,
  subtitle,
  slug,
  closed = false,
  otherUserId,
  initial,
  mediaAllowed = false,
  emailGate,
}: {
  initial?: ChatMessage[];
  /** Falta confirmar el correo: puede leer, no escribir. */
  emailGate?: { email?: string; placeholder?: boolean };
  /** Fotos y audios sólo con identidad verificada. */
  mediaAllowed?: boolean;
  listingId: string;
  title: string;
  subtitle: string;
  /** Sin slug el anuncio ya no está publicado: no hay a dónde enlazar. */
  slug?: string;
  closed?: boolean;
  /** Anfitrión de este chat, para poder bloquearlo. */
  otherUserId?: string;
}) {
  const t = useT();
  const load = useCallback(async (): Promise<ChatMessage[]> => {
    const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}/messages`, { cache: "no-store" });
    if (!res.ok) throw new Error(`messages ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.messages) ? data.messages : [];
  }, [listingId]);

  const send = useCallback(
    async (body: string, meta?: SendMeta): Promise<string | null> => {
      try {
        const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, ...(meta?.original ? { original: meta.original, lang: meta.lang } : {}) }),
        });
        if (res.ok) return null;
        const data = await res.json().catch(() => ({}));
        return typeof data.error === "string" ? data.error : "No se pudo enviar.";
      } catch {
        return "Sin conexión.";
      }
    },
    [listingId]
  );

  const sendAttachment = useCallback(
    (file: Blob, meta: { caption: string; durationSec?: number }) =>
      uploadChatAttachment(file, { ...meta, listingId, as: "guest" }),
    [listingId]
  );

  return (
    <ChatThread
      title={title}
      subtitle={subtitle}
      back="/mensajes"
      me="guest"
      initial={initial}
      seenKey={`g:${listingId}`}
      load={load}
      send={send}
      sendAttachment={closed || emailGate ? undefined : sendAttachment}
      composerLock={
        emailGate ? (
          <div className="space-y-2 pb-1">
            <p className="text-sm text-[#555]">{t("Para escribirle al anfitrión confirma tu correo. Así sabemos que la cuenta es tuya.")}</p>
            <VerifyEmailBox email={emailGate.email} placeholder={emailGate.placeholder} purpose="message" />
          </div>
        ) : undefined
      }
      mediaLockedHref={mediaAllowed ? undefined : "/membresia"}
      translator={closed || emailGate ? undefined : { allowed: mediaAllowed, lockedHref: "/membresia", listingId }}
      emptyText={t("Saluda al anfitrión y pregúntale lo que necesites. Las respuestas las escribe él, no un robot.")}
      closedNotice={closed ? t("Este anuncio ya no está disponible, así que ya no se pueden enviar mensajes.") : undefined}
      headerRight={
        <span className="flex items-center gap-1">
          {otherUserId && <BlockUserButton userId={otherUserId} />}
          {slug && (
            <Link href={`/alojamiento/${slug}`} className="rounded-full px-3 py-1.5 text-sm font-semibold text-[#222] underline">
              {t("Ver anuncio")}
            </Link>
          )}
        </span>
      }
    />
  );
}
