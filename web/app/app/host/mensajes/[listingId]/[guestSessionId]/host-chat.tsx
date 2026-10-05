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
export type HostChatAi = { available: boolean; enabled: boolean };

export function HostChat({
  listingId,
  guestSessionId,
  initial,
  initialAi,
  mediaAllowed = false,
}: {
  mediaAllowed?: boolean;
  listingId: string;
  guestSessionId: string;
  initial?: HostChatInitial;
  initialAi: HostChatAi;
}) {
  const t = useT();
  const [meta, setMeta] = useState<Meta | null>(initial ?? null);
  const [ai, setAi] = useState(initialAi);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  const load = useCallback(async (): Promise<ChatMessage[]> => {
    const data = await revalidate<{ threads?: HostThread[] }>(HOST_URLS.inbox);
    if (!data) throw new Error("offline");
    const threads: HostThread[] = Array.isArray(data.threads) ? data.threads : [];
    const th = threads.find((x) => x.listingId === listingId && x.guestSessionId === guestSessionId);
    if (!th) return [];
    setMeta({ guestName: th.guestName, listingTitle: th.listingTitle, guestEmail: th.guestEmail });
    if (typeof th.aiOn === "boolean") setAi((a) => (a.enabled === th.aiOn ? a : { ...a, enabled: th.aiOn === true }));
    return th.messages;
  }, [listingId, guestSessionId]);

  const toggleAi = async (enabled: boolean) => {
    setAiBusy(true);
    setAiErr(null);
    const res = await fetch("/api/host/chat-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, guestSessionId, enabled }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => null) : null;
    setAiBusy(false);
    if (j && typeof j.enabled === "boolean") setAi({ available: j.available === true, enabled: j.enabled });
    if (!res?.ok) setAiErr(typeof j?.error === "string" ? j.error : "No se pudo cambiar el modo IA.");
    else void revalidate(HOST_URLS.inbox);
  };

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

  const aiOn = ai.available && ai.enabled;

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
      mediaLockedHref={mediaAllowed ? undefined : "/host/motor"}
      emptyText={t("No encontramos esta conversación.")}
      showVia
      headerRight={
        ai.available ? (
          <button
            type="button"
            disabled={aiBusy}
            onClick={() => void toggleAi(!ai.enabled)}
            aria-pressed={ai.enabled}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
              ai.enabled ? "border-[#dcb81e] bg-[#fdf6d8] text-[#5c4a0a]" : "border-[#ddd] text-[#717171]"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${ai.enabled ? "bg-[#1e7a3a]" : "bg-[#bbb]"}`} aria-hidden />
            {t(ai.enabled ? "IA activa" : "IA apagada")}
          </button>
        ) : undefined
      }
      composerLock={
        aiOn ? (
          <div className="space-y-2.5">
            <p className="text-sm leading-relaxed text-[#484848]">
              {t("Tu agente de urbnbeeai está contestando esta conversación. Para escribir tú, desactiva la IA.")}
            </p>
            {aiErr && <p className="text-sm text-red-600">{t(aiErr)}</p>}
            <button
              type="button"
              disabled={aiBusy}
              onClick={() => void toggleAi(false)}
              className="w-full rounded-xl bg-[#111] py-3 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {aiBusy ? t("Guardando…") : t("Desactivar IA y escribir yo")}
            </button>
          </div>
        ) : undefined
      }
    />
  );
}
