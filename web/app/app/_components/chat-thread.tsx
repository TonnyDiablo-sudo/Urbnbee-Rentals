"use client";

import { ChatAttachmentView, type ChatAttachmentClient } from "@/components/chat/attachment-view";
import { VOICE_MAX_SEC, shrinkImage, useVoiceRecorder } from "@/components/chat/media-input";
import { MessageBody } from "@/components/chat/message-body";
import { useTranslateInFlag } from "@/components/chat/use-translate-in";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale, type Lang } from "@/lib/i18n";
import { CHAT_LANGS, chatLangName, isChatLang } from "@/lib/chat-langs";
import { IconCamera, IconImage, IconMic, IconSend, IconTrash } from "./icons";
import { markThreadSeen } from "./seen";
import { Sheet } from "./sheet";
import { TopBar } from "./top-bar";

export type ChatTranslator = {
  /** Tiene la membresía (identidad verificada). */
  allowed: boolean;
  /** A dónde mandar a quien no la tiene. */
  lockedHref: string;
  /** Para traducir el borrador al idioma de la otra persona. */
  listingId: string;
  /** Sólo del lado anfitrión. */
  guestSessionId?: string;
};

/** Lo que el chat manda al guardar: el texto final y, si se tradujo antes de enviar, lo que escribió la persona. */
export type SendMeta = { original?: string; lang?: string };

function IconGlobe({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

export type ChatMessage = {
  id: string;
  sender: "guest" | "host";
  body: string;
  /** Lo que escribió la persona, si `body` llegó traducido. */
  original?: string;
  createdAt: string;
  pending?: boolean;
  attachment?: ChatAttachmentClient;
  /** Transcripción de la nota de voz (traducida si aplica) y la original. */
  transcript?: string;
  transcriptOriginal?: string;
  /** "ai": lo contestó el agente de urbnbeeai. */
  via?: "ai";
};

export type SendAttachment = (file: Blob, meta: { caption: string; durationSec?: number }) => Promise<string | null>;

const POLL_MS = 8_000;

function timeLabel(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const locale = numberLocale(lang);
  return sameDay
    ? d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

/** Conversación a pantalla completa. Consulta cada pocos segundos para que las respuestas aparezcan solas. */
export function ChatThread({
  title,
  subtitle,
  back,
  me,
  seenKey,
  load,
  send,
  emptyText,
  headerRight,
  closedNotice,
  initial,
  sendAttachment,
  composerLock,
  showVia,
  mediaLockedHref,
  translator,
}: {
  /** Traductor del chat: lo que me escriben llega en mi idioma y puedo traducir lo que escribo antes de enviar. */
  translator?: ChatTranslator;
  /** Sin identidad verificada: sólo texto y una liga a la página para verificarse. */
  mediaLockedHref?: string;
  /** Fotos y notas de voz; sin esto el chat es sólo texto. */
  sendAttachment?: SendAttachment;
  /** Mensajes que ya trae la página: la conversación se pinta sin esperar otra consulta. */
  initial?: ChatMessage[];
  title: string;
  subtitle?: string;
  back: string;
  me: "guest" | "host";
  seenKey: string;
  load: () => Promise<ChatMessage[]>;
  /** `meta.original` viene cuando el borrador se tradujo antes de enviar. */
  send: (text: string, meta?: SendMeta) => Promise<string | null>;
  emptyText: string;
  headerRight?: React.ReactNode;
  /** Si viene, la conversación se muestra pero ya no se puede escribir. */
  closedNotice?: string;
  /** Si viene, reemplaza la caja de texto (p. ej. mientras la IA contesta). */
  composerLock?: React.ReactNode;
  /** Marca los mensajes que contestó la IA (sólo lo ve el anfitrión). */
  showVia?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const [messages, setMessages] = useState<ChatMessage[] | null>(initial ?? null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);
  const [langSheet, setLangSheet] = useState(false);
  /** Mostrar traducido lo que me escriben (por conversación). */
  const [translateIn, toggleTranslateIn] = useTranslateInFlag(seenKey);
  /** Idioma en que leo el chat según mi perfil; "" = el del sitio. */
  const [readingLang, setReadingLang] = useState("");
  const [savingLang, setSavingLang] = useState(false);
  /** Borrador traducido antes de enviar: lo que escribí y a qué idioma quedó. */
  const [draft, setDraft] = useState<{ original: string; lang: string | null; same: boolean } | null>(null);
  const [translatingDraft, setTranslatingDraft] = useState(false);

  useEffect(() => {
    if (!translator?.allowed) return;
    let alive = true;
    fetch("/api/account/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setReadingLang(isChatLang(j?.user?.chatLang) ? j.user.chatLang : ""))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [translator?.allowed]);

  const pickReadingLang = async (code: string) => {
    setSavingLang(true);
    setReadingLang(code);
    await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatLang: code }),
    }).catch(() => null);
    setSavingLang(false);
    void refresh();
  };

  const translateDraft = async () => {
    const body = text.trim();
    if (!translator?.allowed || !body || translatingDraft) return;
    setTranslatingDraft(true);
    setErr(null);
    try {
      const res = await fetch("/api/chat/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body, listingId: translator.listingId, guestSessionId: translator.guestSessionId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "No se pudo traducir.");
        return;
      }
      const lang = isChatLang(j.lang) ? j.lang : null;
      if (j.same || typeof j.text !== "string" || !j.text.trim()) {
        setDraft({ original: body, lang, same: true });
        return;
      }
      setText(j.text);
      setDraft({ original: draft?.original ?? body, lang, same: false });
    } catch {
      setErr("Sin conexión.");
    } finally {
      setTranslatingDraft(false);
    }
  };

  const undoDraft = () => {
    if (draft && !draft.same) setText(draft.original);
    setDraft(null);
  };

  const refresh = useCallback(async (sentId?: string) => {
    try {
      const rows = await load();
      setMessages((prev) => [...rows, ...(prev ?? []).filter((x) => x.pending && x.id !== sentId)]);
      const last = rows[rows.length - 1];
      markThreadSeen(seenKey, last?.createdAt);
    } catch {
      setMessages((m) => m ?? []);
    }
  }, [load, seenKey]);

  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(onVisible, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    const n = messages?.length ?? 0;
    if (n !== lastCount.current) {
      lastCount.current = n;
      bottomRef.current?.scrollIntoView({ behavior: n > 0 ? "smooth" : "auto" });
    }
  }, [messages]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    const temp: ChatMessage = { id: `tmp_${Date.now()}`, sender: me, body, createdAt: new Date().toISOString(), pending: true };
    setBusy(true);
    setErr(null);
    setText("");
    const meta: SendMeta | undefined =
      translator?.allowed && draft && !draft.same && draft.original !== body
        ? { original: draft.original, lang: draft.lang ?? undefined }
        : undefined;
    if (meta) temp.original = meta.original;
    setDraft(null);
    setMessages((m) => [...(m ?? []), temp]);
    const error = await send(body, meta);
    setBusy(false);
    if (error) {
      setErr(error);
      setMessages((m) => (m ?? []).filter((x) => x.id !== temp.id));
      setText((cur) => cur || body);
      if (meta) setDraft({ original: meta.original!, lang: meta.lang ?? null, same: false });
      return;
    }
    await refresh(temp.id);
  };

  const canSendMedia = Boolean(sendAttachment) && !mediaLockedHref;
  const voice = useVoiceRecorder();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const sendMedia = async (file: Blob, kind: "image" | "audio", durationSec?: number) => {
    if (!sendAttachment || !canSendMedia) return;
    const caption = kind === "image" ? text.trim() : "";
    const localUrl = URL.createObjectURL(file);
    const temp: ChatMessage = {
      id: `tmp_${Date.now()}`,
      sender: me,
      body: caption,
      createdAt: new Date().toISOString(),
      pending: true,
      attachment: { url: localUrl, kind, durationSec },
    };
    setErr(null);
    if (caption) setText("");
    setMessages((m) => [...(m ?? []), temp]);
    const error = await sendAttachment(file, { caption, durationSec });
    if (error) {
      setErr(error);
      setMessages((m) => (m ?? []).filter((x) => x.id !== temp.id));
      if (caption) setText((cur) => cur || caption);
    } else {
      await refresh(temp.id);
    }
    window.setTimeout(() => URL.revokeObjectURL(localUrl), 30_000);
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setErr("Sólo se pueden mandar fotos y notas de voz.");
    await sendMedia(await shrinkImage(file), "image");
  };

  const finishVoice = useCallback(async () => {
    const out = await voice.stop();
    if (out) await sendMedia(out.blob, "audio", Math.round(out.seconds));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sendMedia cambia en cada render
  }, [voice.stop, sendAttachment]);

  useEffect(() => {
    if (!voice.recording) return;
    const timer = window.setTimeout(() => void finishVoice(), VOICE_MAX_SEC * 1000);
    return () => window.clearTimeout(timer);
  }, [voice.recording, finishVoice]);

  const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const iconBtn = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#222] hover:bg-[#f2f2f2] disabled:opacity-40";

  const translating = Boolean(translator?.allowed && translateIn);
  const readingLabel = readingLang ? chatLangName(readingLang) : lang === "en" ? "English" : "Español";
  const translateButton = translator ? (
    <button
      type="button"
      onClick={() => setLangSheet(true)}
      aria-label={t("Traductor del chat")}
      aria-pressed={translating}
      className={`flex h-10 items-center gap-1 rounded-full px-2.5 text-xs font-semibold ${
        translating ? "bg-[#fdf6d8] text-[#5c4a0a]" : "text-[#555] hover:bg-[#f5f5f5]"
      }`}
    >
      <IconGlobe />
      {translating && <span className="uppercase">{readingLang || lang}</span>}
    </button>
  ) : null;

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        title={title}
        back={back}
        right={
          translateButton || headerRight ? (
            <span className="flex items-center gap-1">
              {translateButton}
              {headerRight}
            </span>
          ) : undefined
        }
      />
      {subtitle && <p className="border-b border-[#f0f0f0] px-5 py-2 text-xs text-[#717171]">{subtitle}</p>}
      {translating && (
        <p className="border-b border-[#f3e9b8] bg-[#fdf6d8] px-5 py-1.5 text-xs text-[#5c4a0a]">
          {t("Traductor activo: lo que te escriben lo lees en {lang}. Toca Traducir antes de enviar para contestar en su idioma.", {
            lang: readingLabel,
          })}
        </p>
      )}

      {translator && (
        <Sheet open={langSheet} onClose={() => setLangSheet(false)} title={t("Traductor del chat")}>
          {translator.allowed ? (
            <div className="space-y-5">
              <section>
                <h3 className="text-sm font-semibold text-[#222]">{t("Lo que me escriben")}</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-[#555]">
                  {t("Los mensajes y las notas de voz de la otra persona se traducen solos al idioma que elijas aquí. Siempre puedes ver el original.")}
                </p>
                <ul className="mt-3 divide-y divide-[#f0f0f0] overflow-hidden rounded-2xl border border-[#ebebeb]">
                  <LangOption on={translateIn} label={t("Traducir a mi idioma")} onClick={() => toggleTranslateIn(true)} />
                  <LangOption on={!translateIn} label={t("Mostrar tal cual me escriben")} onClick={() => toggleTranslateIn(false)} />
                </ul>
              </section>
              <section className={translateIn ? "" : "opacity-50"}>
                <h3 className="text-sm font-semibold text-[#222]">{t("Idioma en que leo el chat")}</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-[#555]">{t("Se guarda en tu perfil y aplica a todas tus conversaciones.")}</p>
                <ul className="mt-3 divide-y divide-[#f0f0f0] overflow-hidden rounded-2xl border border-[#ebebeb]">
                  <LangOption
                    on={!readingLang}
                    label={t("El idioma del sitio ({lang})", { lang: lang === "en" ? "English" : "Español" })}
                    onClick={() => void pickReadingLang("")}
                  />
                  {CHAT_LANGS.map((l) => (
                    <LangOption key={l.code} on={readingLang === l.code} label={l.name} onClick={() => void pickReadingLang(l.code)} />
                  ))}
                </ul>
                {savingLang && <p className="mt-2 text-xs text-[#888]">{t("Guardando…")}</p>}
              </section>
              <section>
                <h3 className="text-sm font-semibold text-[#222]">{t("Lo que escribo")}</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-[#555]">
                  {t("Escribe en tu idioma y toca Traducir junto a Enviar: el mensaje pasa al idioma de la otra persona, lo revisas y lo mandas. Ella podrá ver lo que escribiste.")}
                </p>
              </section>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-[#555]">
                {t("Con la membresía de identidad verificada escribes en tu idioma y tus mensajes llegan traducidos al idioma de la otra persona, además de mandar fotos y notas de voz.")}
              </p>
              <Link href={translator.lockedHref} className="block rounded-xl bg-[#111] py-3 text-center text-[15px] font-semibold text-white">
                {t("Ver membresía")}
              </Link>
            </div>
          )}
        </Sheet>
      )}

      <div className="flex-1 overflow-y-auto bg-[#fafafa] px-4 py-4">
        {messages === null ? (
          <p className="py-10 text-center text-sm text-[#999]">{t("Cargando…")}</p>
        ) : messages.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm leading-relaxed text-[#717171]">{emptyText}</p>
        ) : (
          <ul className="space-y-2.5">
            {messages.map((m) => {
              const mine = m.sender === me;
              // Con la traducción apagada, lo de la otra persona se muestra tal cual lo escribió.
              const raw = !mine && !translateIn;
              return (
                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl text-[15px] leading-snug ${
                      m.attachment?.kind === "image" ? "p-1.5" : "px-3.5 py-2"
                    } ${mine ? "rounded-br-md bg-[#dcb81e] text-black" : "rounded-bl-md border border-[#ebebeb] bg-white text-[#222]"}`}
                  >
                    {m.attachment && (
                      <ChatAttachmentView
                        attachment={m.attachment}
                        mine={mine}
                        transcript={raw ? (m.transcriptOriginal ?? m.transcript) : m.transcript}
                        transcriptOriginal={raw ? undefined : m.transcriptOriginal}
                      />
                    )}
                    {m.body && (
                      <MessageBody
                        body={raw ? (m.original ?? m.body) : m.body}
                        original={raw ? undefined : m.original}
                        mine={mine}
                        className={`whitespace-pre-wrap break-words ${m.attachment?.kind === "image" ? "px-2 pt-1.5" : m.attachment ? "pt-1" : ""}`}
                      />
                    )}
                    <p
                      className={`mt-0.5 text-right text-[10px] ${mine ? "text-black/60" : "text-[#999]"} ${
                        m.attachment?.kind === "image" ? "px-2 pb-0.5" : ""
                      }`}
                      // La hora se formatea con el ICU del servidor y del navegador: puede diferir en un espacio.
                      suppressHydrationWarning
                    >
                      {m.via === "ai" && showVia ? `${t("Respondido por IA")} · ` : ""}
                      {m.pending ? t("Enviando…") : timeLabel(m.createdAt, lang)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      {closedNotice ? (
        <p
          className="border-t border-[#ebebeb] bg-white px-5 pt-3 text-center text-sm text-[#717171]"
          style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
        >
          {closedNotice}
        </p>
      ) : composerLock ? (
        <div className="border-t border-[#ebebeb] bg-white px-4 pt-3" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
          {composerLock}
        </div>
      ) : (
      <form
        onSubmit={submit}
        className="border-t border-[#ebebeb] bg-white px-3 pt-2.5"
        style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}
      >
        {(err || voice.error) && <p className="mb-2 px-2 text-sm text-red-600">{t(err ?? voice.error ?? "")}</p>}
        {draft && text.trim() && (
          <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-2 text-xs text-[#5c4a0a]">
            <span>
              {draft.same
                ? t("Ya está en el idioma de la otra persona.")
                : draft.lang
                  ? t("Traducido al {lang} · revísalo y envía.", { lang: chatLangName(draft.lang) })
                  : t("Traducido · revísalo y envía.")}
            </span>
            <button type="button" onClick={undoDraft} className="font-semibold underline">
              {draft.same ? t("Ocultar") : t("Deshacer")}
            </button>
          </p>
        )}
        {voice.recording ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void voice.stop(true)} className={iconBtn} aria-label={t("Descartar nota de voz")}>
              <IconTrash />
            </button>
            <div className="flex min-h-[44px] flex-1 items-center gap-2.5 rounded-2xl bg-[#fdecea] px-4 text-[15px] text-[#b42318]">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#e0452b]" aria-hidden />
              <span className="font-semibold tabular-nums">{clock(voice.seconds)}</span>
              <span className="truncate text-sm">{t("Grabando nota de voz…")}</span>
            </div>
            <button
              type="button"
              onClick={() => void finishVoice()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#111] text-white"
              aria-label={t("Enviar nota de voz")}
            >
              <IconSend />
            </button>
          </div>
        ) : (
          <>
          {sendAttachment && mediaLockedHref && (
            <p className="mb-2 px-2 text-xs text-[#717171]">
              <Link href={mediaLockedHref} className="font-semibold text-[#222] underline">
                {t("Verifica tu identidad para mandar fotos y audios.")}
              </Link>
            </p>
          )}
          <div className="flex items-end gap-1">
            {canSendMedia && (
              <>
                <button type="button" onClick={() => cameraRef.current?.click()} className={iconBtn} aria-label={t("Tomar foto")}>
                  <IconCamera />
                </button>
                <button type="button" onClick={() => galleryRef.current?.click()} className={iconBtn} aria-label={t("Mandar foto")}>
                  <IconImage />
                </button>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onPickImage(e)} />
                <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPickImage(e)} />
              </>
            )}
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (!e.target.value.trim()) setDraft(null);
              }}
              rows={1}
              maxLength={2000}
              placeholder={t("Escribe un mensaje")}
              className="ml-1 max-h-32 min-h-[44px] min-w-0 flex-1 resize-none rounded-2xl border border-[#ddd] px-4 py-2.5 text-[15px] outline-none focus:border-[#222]"
            />
            {translator?.allowed && text.trim() && (
              <button
                type="button"
                onClick={() => void translateDraft()}
                disabled={translatingDraft || busy}
                className={`${iconBtn} ${draft && !draft.same ? "bg-[#fdf6d8] text-[#5c4a0a]" : ""}`}
                aria-label={t("Traducir al idioma de la otra persona")}
                title={t("Traducir al idioma de la otra persona")}
              >
                {translatingDraft ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                ) : (
                  <IconGlobe />
                )}
              </button>
            )}
            {canSendMedia && voice.supported && !text.trim() ? (
              <button
                type="button"
                onClick={() => void voice.start()}
                className="ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#111] text-white"
                aria-label={t("Grabar nota de voz")}
              >
                <IconMic className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={busy || !text.trim()}
                className="ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#111] text-white disabled:opacity-40"
                aria-label={t("Enviar")}
              >
                <IconSend />
              </button>
            )}
          </div>
          </>
        )}
      </form>
      )}
    </div>
  );
}

function LangOption({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} aria-pressed={on} className="flex w-full items-center justify-between px-4 py-3 text-left text-[15px] text-[#222]">
        <span>{label}</span>
        <span className={`h-5 w-5 shrink-0 rounded-full border-2 ${on ? "border-[#222] bg-[#222] shadow-[inset_0_0_0_3px_#fff]" : "border-[#bbb]"}`} aria-hidden />
      </button>
    </li>
  );
}
