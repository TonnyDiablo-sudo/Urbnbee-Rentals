"use client";

import { useCallback, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { ChatThread, type ChatMessage } from "../../../../_components/chat-thread";
import type { HostThread } from "../../host-inbox";

export function HostChat({ listingId, guestSessionId }: { listingId: string; guestSessionId: string }) {
  const t = useT();
  const [meta, setMeta] = useState<{ guestName: string; listingTitle: string; guestEmail?: string } | null>(null);

  const load = useCallback(async (): Promise<ChatMessage[]> => {
    const res = await fetch("/api/host/inbox", { cache: "no-store" });
    const data = await res.json();
    const threads: HostThread[] = Array.isArray(data.threads) ? data.threads : [];
    const th = threads.find((x) => x.listingId === listingId && x.guestSessionId === guestSessionId);
    if (!th) return [];
    setMeta({ guestName: th.guestName, listingTitle: th.listingTitle, guestEmail: th.guestEmail });
    return th.messages;
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
        return t(typeof j.error === "string" ? j.error : "No se pudo enviar.");
      } catch {
        return t("Sin conexión.");
      }
    },
    [listingId, guestSessionId, t]
  );

  return (
    <ChatThread
      title={meta?.guestName ?? t("Conversación")}
      subtitle={meta ? `${meta.listingTitle}${meta.guestEmail ? ` · ${meta.guestEmail}` : ""}` : undefined}
      back="/host/mensajes"
      me="host"
      seenKey={`h:${listingId}:${guestSessionId}`}
      load={load}
      send={send}
      emptyText={t("No encontramos esta conversación.")}
    />
  );
}
