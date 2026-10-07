"use client";

import { ChatAttachmentView, type ChatAttachmentClient } from "@/components/chat/attachment-view";
import { MessageBody } from "@/components/chat/message-body";
import { chatMatches, useChatSearch } from "@/components/chat/chat-search";
import {
  BOOKING_FILTERS,
  bookingLine,
  threadMatchesBooking,
  type BookingFilter,
  type ThreadBooking,
} from "@/components/chat/thread-booking";
import { ChatsSwitch } from "@/components/team/chats-switch";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { DraftTranslateControls, TranslatorBar, useWebChatTranslator } from "@/components/chat/web-translator";
import { numberLocale } from "@/lib/i18n";

type Msg = {
  id: string;
  sender: "guest" | "host";
  body: string;
  original?: string;
  createdAt: string;
  guestName: string;
  attachment?: ChatAttachmentClient;
  transcript?: string;
  transcriptOriginal?: string;
  via?: "ai";
};

type Thread = {
  listingId: string;
  listingTitle: string;
  guestSessionId: string;
  guestName: string;
  guestEmail?: string;
  lastAt: string;
  messages: Msg[];
  booking?: ThreadBooking;
};

export default function HostMessagesPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <ChatsSwitch web own guestsLabel="Huéspedes">
        <HostGuestChats />
      </ChatsSwitch>
    </div>
  );
}

function HostGuestChats() {
  const t = useT();
  const lang = useLang();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [translatorLocked, setTranslatorLocked] = useState(false);
  const [listingFilter, setListingFilter] = useState("");
  const [bookingFilter, setBookingFilter] = useState<BookingFilter | "">("");
  const query = useChatSearch();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/host/inbox", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error");
        return;
      }
      setThreads(data.threads ?? []);
      // `readingLang: null` = sin traductor (falta la verificación de identidad).
      setTranslatorLocked(data.readingLang === null);
    } catch {
      setError("Error de red.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function sendReply(th: Thread, meta: { original: string; lang?: string } | null, onSent: () => void, onLocked: () => void) {
    const key = `${th.listingId}:${th.guestSessionId}`;
    const body = (replyText[key] ?? "").trim();
    if (!body || sending) return;
    setSending(key);
    try {
      const res = await fetch("/api/host/inbox/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          listingId: th.listingId,
          guestSessionId: th.guestSessionId,
          body,
          ...(meta ?? {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.translatorLocked) onLocked();
        alert(t(data.error ?? "No se pudo enviar."));
        return;
      }
      setReplyText((prev) => ({ ...prev, [key]: "" }));
      onSent();
      await load();
    } catch {
      alert(t("Error de red."));
    } finally {
      setSending(null);
    }
  }

  const listingOptions = [...new Map(threads.map((th) => [th.listingId, th.listingTitle])).entries()]
    .map(([id, title]) => ({ id, title, count: threads.filter((th) => th.listingId === id).length }))
    .sort((a, b) => a.title.localeCompare(b.title));
  const shown = threads
    .filter((th) => !listingFilter || th.listingId === listingFilter)
    .filter((th) => threadMatchesBooking(th.booking, bookingFilter || null))
    .filter((th) => chatMatches(query, th.guestName, th.listingTitle, ...th.messages.map((m) => m.body)));
  const selectCls = "max-w-[16rem] rounded-full border border-[#ddd] bg-white px-3 py-1.5 text-sm text-[#222] outline-none focus:border-[#dcb81e]";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#484848]">{t("Mensajes de huéspedes")}</h1>
        <p className="mt-1 text-sm text-[#888]">
          {t("Conversaciones iniciadas desde la ficha pública.")}{" "}
          <strong className="font-medium text-[#666]">
            {t("No pidas ni envíes pagos fuera de los canales oficiales de Cabibee cuando existan.")}
          </strong>
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[#888]">{t("Cargando…")}</p>
      ) : error ? (
        <p className="text-sm text-red-700">{t(error)}</p>
      ) : threads.length === 0 ? (
        <div className="rounded-xl border border-[#ebebeb] bg-white p-10 text-center text-sm text-[#888] shadow-sm">
          {t("Nadie ha escrito todavía en el chat de tus alojamientos.")}
        </div>
      ) : (
        <>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="chat-listing-filter">{t("Alojamiento")}</label>
          <select
            id="chat-listing-filter"
            value={listingFilter}
            onChange={(e) => setListingFilter(e.target.value)}
            className={`${selectCls} ${listingFilter ? "border-[#222] font-medium" : ""}`}
          >
            <option value="">{t("Alojamiento")}: {t("todos")}</option>
            {listingOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title} ({o.count})
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="chat-booking-filter">{t("Reserva")}</label>
          <select
            id="chat-booking-filter"
            value={bookingFilter}
            onChange={(e) => setBookingFilter(e.target.value as BookingFilter | "")}
            className={`${selectCls} ${bookingFilter ? "border-[#222] font-medium" : ""}`}
          >
            <option value="">{t("Reserva")}: {t("todas")}</option>
            {BOOKING_FILTERS.map((f) => (
              <option key={f.id} value={f.id}>
                {t(f.label)} ({threads.filter((th) => threadMatchesBooking(th.booking, f.id)).length})
              </option>
            ))}
          </select>
          {(listingFilter || bookingFilter) && (
            <button
              type="button"
              onClick={() => { setListingFilter(""); setBookingFilter(""); }}
              className="text-xs text-[#888] underline"
            >
              {t("Quitar filtros")}
            </button>
          )}
        </div>
        {shown.length === 0 && <p className="text-sm text-[#888]">{t("No hay chats que coincidan.")}</p>}
        <ul className="space-y-4">
          {shown.map((th) => {
            const key = `${th.listingId}:${th.guestSessionId}`;
            const open = expanded === key;
            const last = th.messages[th.messages.length - 1];
            return (
              <li key={key} className="overflow-hidden rounded-xl border border-[#ebebeb] bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : key)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#fafafa]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#484848]">{th.guestName}</p>
                    <p className="truncate text-xs font-medium text-[#7a6412]">
                      <span aria-hidden>🏠 </span>
                      {th.listingTitle}
                      {th.booking && <span className="font-normal text-[#aaa]"> · {bookingLine(th.booking, t, lang)}</span>}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-[#888]">{last?.body}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-[#aaa]">
                    {new Date(th.lastAt).toLocaleString(numberLocale(lang), { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </button>

                {open && (
                  <OpenThread
                    th={th}
                    text={replyText[key] ?? ""}
                    onText={(v) => setReplyText((prev) => ({ ...prev, [key]: v }))}
                    sending={sending === key}
                    translatorLocked={translatorLocked}
                    onSend={(meta, onSent, onLocked) => void sendReply(th, meta, onSent, onLocked)}
                  />
                )}
              </li>
            );
          })}
        </ul>
        </>
      )}
    </div>
  );
}

/** Conversación abierta: mensajes, traductor y caja de respuesta. */
function OpenThread({
  th,
  text,
  onText,
  sending,
  translatorLocked,
  onSend,
}: {
  th: Thread;
  text: string;
  onText: (v: string) => void;
  sending: boolean;
  translatorLocked: boolean;
  onSend: (meta: { original: string; lang?: string } | null, onSent: () => void, onLocked: () => void) => void;
}) {
  const t = useT();
  const lang = useLang();
  const tr = useWebChatTranslator({
    listingId: th.listingId,
    guestSessionId: th.guestSessionId,
    storageKey: `h:${th.listingId}:${th.guestSessionId}`,
    hostSide: true,
    locked: translatorLocked,
  });
  return (
    <div className="border-t border-[#ebebeb] px-4 py-4">
      <div className="mb-3 rounded-lg border border-[#f3e9b8] bg-[#fffbea] px-3 py-2 text-xs leading-relaxed text-[#5c4a0a]">
        <p>
          {t("Este chat viene de tu anuncio")}{" "}
          <Link href={`/host/listings/${th.listingId}/edit`} className="font-semibold underline">
            {th.listingTitle}
          </Link>
          .
        </p>
        <p className="mt-0.5 text-[#7a6412]">
          {th.booking ? (
            <>
              {t("Reserva:")}{" "}
              <Link href={`/host/reservas/${encodeURIComponent(th.booking.id)}`} className="underline">
                {bookingLine(th.booking, t, lang)}
              </Link>
            </>
          ) : (
            t("Sin reserva en este alojamiento: te pregunta antes de reservar.")
          )}
        </p>
      </div>
      {th.guestEmail && (
        <p className="mb-3 text-xs text-[#666]">
          {t("Correo del huésped (opcional):")}{" "}
          <a className="font-medium text-[#dcb81e] underline" href={`mailto:${th.guestEmail}`}>
            {th.guestEmail}
          </a>
        </p>
      )}
      <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg bg-[#fafafa] p-3">
        {th.messages.map((m) => {
          const mine = m.sender === "host";
          // Con la traducción apagada, lo del huésped se muestra tal cual lo escribió.
          const raw = !mine && !tr.translateIn;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${mine ? "bg-[#dcb81e] text-black" : "border border-[#ebebeb] bg-white text-[#3a3a3a]"}`}>
                <span className="text-[10px] font-bold uppercase opacity-70">
                  {mine ? t(m.via === "ai" ? "Respondido por IA" : "Tú") : m.guestName || t("Huésped")}
                </span>
                {m.attachment && (
                  <div className="mt-1">
                    <ChatAttachmentView
                      attachment={m.attachment}
                      mine={mine}
                      transcript={raw ? (m.transcriptOriginal ?? m.transcript) : m.transcript}
                      transcriptOriginal={raw ? undefined : m.transcriptOriginal}
                    />
                  </div>
                )}
                {m.body && (
                  <MessageBody body={raw ? (m.original ?? m.body) : m.body} original={raw ? undefined : m.original} mine={mine} className="mt-0.5 whitespace-pre-wrap" />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 rounded-lg bg-[#fafafa] px-3 py-2.5">
        <p className="mb-1.5 text-xs font-semibold text-[#666]">{t("Traductor del chat")}</p>
        <TranslatorBar tr={tr} lockedHref="/host/verificacion" lockedCta={t("Verificar mi identidad")} />
      </div>
      <div className="mt-3 flex gap-2">
        <textarea
          value={text}
          onChange={(e) => {
            onText(e.target.value);
            if (!e.target.value.trim()) tr.setDraft(null);
          }}
          rows={2}
          maxLength={2000}
          placeholder={t("Tu respuesta…")}
          className="min-w-0 flex-1 resize-y rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
        />
        <button
          type="button"
          disabled={sending || !text.trim()}
          onClick={() => onSend(tr.sendMeta(text), () => tr.setDraft(null), tr.markLocked)}
          className="shrink-0 self-end rounded-full px-4 py-2 text-sm font-semibold text-black shadow disabled:opacity-50"
          style={{ backgroundColor: "#dcb81e" }}
        >
          {sending ? "…" : t("Responder")}
        </button>
      </div>
      <div className="mt-2">
        <DraftTranslateControls tr={tr} text={text} onText={onText} disabled={sending} />
      </div>
      <Link href={`/host/listings/${th.listingId}/edit`} className="mt-2 inline-block text-xs text-[#dcb81e] underline">
        {t("Editar este alojamiento")}
      </Link>
    </div>
  );
}
