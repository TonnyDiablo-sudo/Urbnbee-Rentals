"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useT } from "@/components/i18n-provider";
import { ChatThread, type ChatMessage } from "../../_components/chat-thread";

export function GuestChat({
  listingId,
  title,
  subtitle,
  slug,
  closed = false,
  initial,
}: {
  initial?: ChatMessage[];
  listingId: string;
  title: string;
  subtitle: string;
  /** Sin slug el anuncio ya no está publicado: no hay a dónde enlazar. */
  slug?: string;
  closed?: boolean;
}) {
  const t = useT();
  const load = useCallback(async (): Promise<ChatMessage[]> => {
    const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}/messages`, { cache: "no-store" });
    const data = await res.json();
    return Array.isArray(data.messages) ? data.messages : [];
  }, [listingId]);

  const send = useCallback(
    async (body: string): Promise<string | null> => {
      try {
        const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
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
      emptyText={t("Saluda al anfitrión y pregúntale lo que necesites. Las respuestas las escribe él, no un robot.")}
      closedNotice={closed ? t("Este anuncio ya no está disponible, así que ya no se pueden enviar mensajes.") : undefined}
      headerRight={
        slug ? (
          <Link href={`/alojamiento/${slug}`} className="rounded-full px-3 py-1.5 text-sm font-semibold text-[#222] underline">
            {t("Ver anuncio")}
          </Link>
        ) : undefined
      }
    />
  );
}
