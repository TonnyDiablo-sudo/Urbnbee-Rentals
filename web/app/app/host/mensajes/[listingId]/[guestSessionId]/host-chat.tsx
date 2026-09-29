"use client";

import { useCallback, useState } from "react";
import { ChatThread, type ChatMessage } from "../../../../_components/chat-thread";
import type { HostThread } from "../../host-inbox";

export function HostChat({ listingId, guestSessionId }: { listingId: string; guestSessionId: string }) {
  const [meta, setMeta] = useState<{ guestName: string; listingTitle: string; guestEmail?: string } | null>(null);

  const load = useCallback(async (): Promise<ChatMessage[]> => {
    const res = await fetch("/api/host/inbox", { cache: "no-store" });
    const data = await res.json();
    const threads: HostThread[] = Array.isArray(data.threads) ? data.threads : [];
    const t = threads.find((x) => x.listingId === listingId && x.guestSessionId === guestSessionId);
    if (!t) return [];
    setMeta({ guestName: t.guestName, listingTitle: t.listingTitle, guestEmail: t.guestEmail });
    return t.messages;
  }, [listingId, guestSessionId]);

  const send = useCallback(
    async (body: string): Promise<string | null> => {
      try {
        const res = await fetch("/api/host/inbox/reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId, guestSessionId, body }),
        });
        if (res.ok) return null;
        const j = await res.json().catch(() => ({}));
        return typeof j.error === "string" ? j.error : "No se pudo enviar.";
      } catch {
        return "Sin conexión.";
      }
    },
    [listingId, guestSessionId]
  );

  return (
    <ChatThread
      title={meta?.guestName ?? "Conversación"}
      subtitle={meta ? `${meta.listingTitle}${meta.guestEmail ? ` · ${meta.guestEmail}` : ""}` : undefined}
      back="/host/mensajes"
      me="host"
      seenKey={`h:${listingId}:${guestSessionId}`}
      load={load}
      send={send}
      emptyText="No encontramos esta conversación."
    />
  );
}
