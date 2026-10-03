"use client";

import { useCallback, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { revalidate } from "../../../../_components/cached-fetch";
import { uploadChatAttachment } from "@/components/chat/upload";
import { ChatThread, type ChatMessage } from "../../../../_components/chat-thread";
import { HOST_URLS } from "../../../_shared/host-data";
import type { HostThread } from "../../host-inbox";

type Meta = { guestName: string; listingTitle: string; guestEmail?: string };
export type HostChatInitial = Meta & { messages: ChatMessage[] };

export function HostChat({
  listingId,
  guestSessionId,
  initial,
}: {
  listingId: string;
  guestSessionId: string;
  initial?: HostChatInitial;
}) {
  const t = useT();
  const [meta, setMeta] = useState<Meta | null>(initial ?? null);

  const load = useCallback(async (): Promise<ChatMessage[]> => {
    const data = await revalidate<{ threads?: HostThread[] }>(HOST_URLS.inbox);
    if (!data) throw new Error("offline");
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

  const sendAttachment = useCallback(
    (file: Blob, meta: { caption: string; durationSec?: number }) =>
      uploadChatAttachment(file, { ...meta, listingId, guestSessionId, as: "host" }),
    [listingId, guestSessionId]
  );

  return (
    <ChatThread
      title={meta?.guestName || t("Conversación")}
      subtitle={meta ? `${meta.listingTitle}${meta.guestEmail ? ` · ${meta.guestEmail}` : ""}` : undefined}
      back="/host/mensajes"
      me="host"
      initial={initial?.messages}
      seenKey={`h:${listingId}:${guestSessionId}`}
      load={load}
      send={send}
      sendAttachment={sendAttachment}
      emptyText={t("No encontramos esta conversación.")}
    />
  );
}
