"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { chatMatches, useChatSearch } from "@/components/chat/chat-search";
import {
  BOOKING_FILTERS,
  bookingFilterLabel,
  bookingLine,
  threadMatchesBooking,
  type BookingFilter,
  type ThreadBooking,
} from "@/components/chat/thread-booking";
import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale } from "@/lib/i18n";
import type { ChatAttachmentView } from "@/lib/host-inbox-types";
import { revalidate, useCached } from "../../_components/cached-fetch";
import { threadIsUnread } from "../../_components/seen";
import { Sheet } from "../../_components/sheet";
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
  /** Reserva del huésped en ese alojamiento, si la hay. */
  booking?: ThreadBooking;
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
  const [listingFilter, setListingFilter] = useState<string | null>(null);
  const [bookingFilter, setBookingFilter] = useState<BookingFilter | null>(null);
  const [sheet, setSheet] = useState<"listing" | "booking" | null>(null);
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
  // Alojamientos con chats, para el filtro (con cuántas conversaciones tiene cada uno).
  const listingOptions = [...new Map(threads.map((th) => [th.listingId, th.listingTitle])).entries()]
    .map(([id, title]) => ({ id, title, count: threads.filter((th) => th.listingId === id).length }))
    .sort((a, b) => a.title.localeCompare(b.title));
  const bookingCount = (f: BookingFilter) => threads.filter((th) => threadMatchesBooking(th.booking, f)).length;
  const shown = (onlyUnread ? threads.filter(isUnread) : threads)
    .filter((th) => !listingFilter || th.listingId === listingFilter)
    .filter((th) => threadMatchesBooking(th.booking, bookingFilter))
    .filter((th) => chatMatches(query, th.guestName, th.listingTitle, ...th.messages.map((m) => m.body)));
  const listingFilterTitle = listingFilter ? listingOptions.find((o) => o.id === listingFilter)?.title : null;
  const filtered = Boolean(listingFilter || bookingFilter);

  const chip = (on: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium ${on ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] text-[#222]"}`;
  const option = (on: boolean) =>
    `flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm ${on ? "bg-[#fdf6d8] font-semibold text-[#222]" : "text-[#222] active:bg-[#fafafa]"}`;

  return (
    <>
    <div className="flex gap-2 overflow-x-auto px-5 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {[
        { v: false, label: t("Todos") },
        { v: true, label: `${t("No leídos")}${unreadCount ? ` (${unreadCount})` : ""}` },
      ].map((o) => (
        <button key={String(o.v)} type="button" onClick={() => setOnlyUnread(o.v)} className={chip(onlyUnread === o.v)}>
          {o.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setSheet("listing")}
        aria-haspopup="dialog"
        className={`${chip(Boolean(listingFilter))} max-w-[11rem] truncate`}
        title={listingFilterTitle ?? t("Alojamiento")}
      >
        {listingFilterTitle ?? t("Alojamiento")} ▾
      </button>
      <button type="button" onClick={() => setSheet("booking")} aria-haspopup="dialog" className={chip(Boolean(bookingFilter))}>
        {bookingFilter ? bookingFilterLabel(bookingFilter, t) : t("Reserva")} ▾
      </button>
    </div>

    <Sheet open={sheet === "listing"} onClose={() => setSheet(null)} title={t("Chats por alojamiento")}>
      <ul className="divide-y divide-[#f0f0f0] overflow-hidden rounded-2xl border border-[#ebebeb]">
        <li>
          <button type="button" className={option(!listingFilter)} onClick={() => { setListingFilter(null); setSheet(null); }}>
            <span>{t("Todos los alojamientos")}</span>
            <span className="text-xs text-[#999]">{threads.length}</span>
          </button>
        </li>
        {listingOptions.map((o) => (
          <li key={o.id}>
            <button type="button" className={option(listingFilter === o.id)} onClick={() => { setListingFilter(o.id); setSheet(null); }}>
              <span className="min-w-0 truncate">{o.title}</span>
              <span className="shrink-0 text-xs text-[#999]">{o.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>

    <Sheet open={sheet === "booking"} onClose={() => setSheet(null)} title={t("Chats por reserva")}>
      <p className="mb-3 text-sm leading-relaxed text-[#555]">
        {t("Se busca la reserva de ese huésped en el alojamiento del chat: así sabes si te habla de una estancia que viene, que está en curso o que ya terminó.")}
      </p>
      <ul className="divide-y divide-[#f0f0f0] overflow-hidden rounded-2xl border border-[#ebebeb]">
        <li>
          <button type="button" className={option(!bookingFilter)} onClick={() => { setBookingFilter(null); setSheet(null); }}>
            <span>{t("Todas las conversaciones")}</span>
            <span className="text-xs text-[#999]">{threads.length}</span>
          </button>
        </li>
        {BOOKING_FILTERS.map((f) => (
          <li key={f.id}>
            <button type="button" className={option(bookingFilter === f.id)} onClick={() => { setBookingFilter(f.id); setSheet(null); }}>
              <span>{t(f.label)}</span>
              <span className="text-xs text-[#999]">{bookingCount(f.id)}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>

    {shown.length === 0 && (
      <p className="px-5 py-6 text-sm text-[#717171]">
        {query.trim() || filtered ? t("No hay chats que coincidan.") : t("No tienes mensajes sin leer.")}
      </p>
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
                <p className="flex items-center gap-1.5 text-xs text-[#5c4a0a]">
                  <span aria-hidden>🏠</span>
                  <span className="truncate font-medium">{th.listingTitle}</span>
                  {th.aiOn && <span className="shrink-0 rounded-full bg-[#fdf6d8] px-1.5 py-px text-[10px] font-bold text-[#5c4a0a]">{t("IA")}</span>}
                </p>
                {th.booking && <p className="text-xs text-[#999]">{bookingLine(th.booking, t, lang)}</p>}
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
