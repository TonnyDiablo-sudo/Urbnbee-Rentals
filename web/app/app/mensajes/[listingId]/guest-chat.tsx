"use client";

import Link from "next/link";
import { useCallback } from "react";
import { ChatThread, type ChatMessage } from "../../_components/chat-thread";

export function GuestChat({
  listingId,
  title,
  subtitle,
  slug,
}: {
  listingId: string;
  title: string;
  subtitle: string;
  slug: string;
}) {
  const load = useCallback(async (): Promise<ChatMessage[]> => {
    const res = await fetch(`/api/listings/${listingId}/messages`, { cache: "no-store" });
    const data = await res.json();
    return Array.isArray(data.messages) ? data.messages : [];
  }, [listingId]);

  const send = useCallback(
    async (body: string): Promise<string | null> => {
      try {
        const res = await fetch(`/api/listings/${listingId}/messages`, {
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
      seenKey={`g:${listingId}`}
      load={load}
      send={send}
      emptyText="Saluda al anfitrión y pregúntale lo que necesites. Las respuestas las escribe él, no un robot."
      headerRight={
        <Link href={`/alojamiento/${slug}`} className="rounded-full px-3 py-1.5 text-sm font-semibold text-[#222] underline">
          Ver anuncio
        </Link>
      }
    />
  );
}
