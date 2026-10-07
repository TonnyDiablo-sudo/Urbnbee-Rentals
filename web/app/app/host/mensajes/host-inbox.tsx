"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { chatMatches, useChatSearch } from "@/components/chat/chat-search";
import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale } from "@/lib/i18n";
import type { ChatAttachmentView } from "@/lib/host-inbox-types";
import { revalidate, useCached } from "../../_components/cached-fetch";
import { threadIsUnread } from "../../_components/seen";
import { HOST_URLS } from "../_shared/host-data";

export type HostThread = {
  listingId: string;
  listingTitle: string;
  guestSessionId: string;
  guestName: string;
  guestEmail?: string;
  lastAt: string;
  messages: {
    id: string;
    sender: "guest" | "host";
    body: string;
    original?: string;
    createdAt: string;
    attachment?: ChatAttachmentView;
    transcript?: string;
    transcriptOriginal?: string;
    via?: "ai";
  }[];
  /** El agente de urbnbeeai contesta esta conversación. */
  aiOn?: boolean;
};

export function hostThreadHref(t: { listingId: string; guestSessionId: string }) {
  return `/host/mensajes/${encodeURIComponent(t.listingId)}/${encodeURIComponent(t.guestSessionId)}`;
}

export function HostInbox() {
  const t = useT();
  const lang = useLang();
  const inbox = useCached<{ threads?: HostThread[] }>(HOST_URLS.inbox);
  const threads = inbox.data ? (Array.isArray(inbox.data.threads) ? inbox.data.threads : []) : inbox.error ? [] : null;
  const [onlyUnread, setOnlyUnread] = useState(false);
  const query = useChatSearch();

  useEffect(() => {
    const timer = window.setInterval(() => document.visibilityState === "visible" && void revalidate(HOST_URLS.inbox), 20_000);
    return () => window.clearInterval(timer);
  }, []);

  if (threads === null) return <p className="px-5 py-6 text-sm text-[#999]">{t("Cargando…")}</p>;
  if (threads.length === 0) {
    return (
      <div className="px-5 py-8">
        <p className="text-base font-semibold text-[#222]">{t("Aún no te escriben")}</p>
        <p className="mt-1 text-sm leading-relaxed text-[#717171]">
          {t("Cuando un huésped te escriba desde tu anuncio en la web o en la app, lo verás aquí.")}
        </p>
      </div>
    );
  }

  const isUnread = (th: HostThread) =>
    th.messages[th.messages.length - 1]?.sender === "guest" && threadIsUnread(`h:${th.listingId}:${th.guestSessionId}`, th.lastAt);
  const unreadCount = threads.filter(isUnread).length;
  const shown = (onlyUnread ? threads.filter(isUnread) : threads).filter((th) =>
    chatMatches(query, th.guestName, th.listingTitle, ...th.messages.map((m) => m.body))
  );

  return (
    <>
    <div className="flex gap-2 px-5 pb-2">
      {[
        { v: false, label: t("Todos") },
        { v: true, label: `${t("No leídos")}${unreadCount ? ` (${unreadCount})` : ""}` },
      ].map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => setOnlyUnread(o.v)}
          className={`rounded-full border px-4 py-2 text-sm font-medium ${onlyUnread === o.v ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] text-[#222]"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
    {shown.length === 0 && (
      <p className="px-5 py-6 text-sm text-[#717171]">{query.trim() ? t("No hay chats que coincidan.") : t("No tienes mensajes sin leer.")}</p>
    )}
    <ul className="divide-y divide-[#f0f0f0]">
      {shown.map((th) => {
        const last = th.messages[th.messages.length - 1];
        const unread = isUnread(th);
        return (
          <li key={`${th.listingId}:${th.guestSessionId}`}>
            <Link href={hostThreadHref(th)} prefetch className="flex items-start gap-3 px-5 py-4 active:bg-[#fafafa]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#111] text-base font-bold text-[#dcb81e]">
                {th.guestName.trim().charAt(0).toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`truncate text-[15px] ${unread ? "font-bold" : "font-semibold"} text-[#222]`}>{th.guestName}</p>
                  <span className="shrink-0 text-xs text-[#999]">
                    {new Date(th.lastAt).toLocaleDateString(numberLocale(lang), { day: "numeric", month: "short" })}
                  </span>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-[#999]">
                  <span className="truncate">{th.listingTitle}</span>
                  {th.aiOn && <span className="shrink-0 rounded-full bg-[#fdf6d8] px-1.5 py-px text-[10px] font-bold text-[#5c4a0a]">{t("IA")}</span>}
                </p>
                <p className={`mt-0.5 line-clamp-2 text-sm ${unread ? "text-[#222]" : "text-[#717171]"}`}>
                  {last?.sender === "host" ? `${t(last.via === "ai" ? "IA:" : "Tú:")} ` : ""}
                  {last?.body || (last?.attachment ? t(last.attachment.kind === "image" ? "📷 Foto" : "🎤 Nota de voz") : "")}
                </p>
              </div>
              {unread && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#e0452b]" />}
            </Link>
          </li>
        );
      })}
    </ul>
    </>
  );
}
