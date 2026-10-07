"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { CHAT_LANGS, chatLangName, isChatLang } from "@/lib/chat-langs";
import { useTranslateInFlag } from "@/components/chat/use-translate-in";

/**
 * Traductor del chat en la web (anfitrión y huésped): lo que me escriben se lee en el idioma de mi perfil
 * y puedo traducir mi borrador al idioma de la otra persona antes de enviarlo.
 */

export type DraftState = { original: string; lang: string | null; same: boolean };

export function useWebChatTranslator(opts: { listingId: string; guestSessionId?: string; storageKey: string; hostSide?: boolean }) {
  const [translateIn, setTranslateIn] = useTranslateInFlag(opts.storageKey);
  const [readingLang, setReadingLangState] = useState("");
  const [locked, setLocked] = useState(false);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/account/profile", { cache: "no-store", credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j?.user) return;
        setReadingLangState(isChatLang(j.user.chatLang) ? j.user.chatLang : "");
        // Del lado anfitrión también cuenta la identidad del dueño del anuncio; el servidor lo confirma al traducir.
        if (j.user.chatTranslator === false && !opts.hostSide) setLocked(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo al montar
  }, []);

  const setReadingLang = async (code: string): Promise<void> => {
    setReadingLangState(code);
    await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ chatLang: code }),
    }).catch(() => null);
  };

  const translateDraft = useCallback(
    async (text: string): Promise<string | null> => {
      const body = text.trim();
      if (!body || translating) return null;
      setTranslating(true);
      setError(null);
      try {
        const res = await fetch("/api/chat/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text: body, listingId: opts.listingId, guestSessionId: opts.guestSessionId }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 403 && j.translatorLocked) setLocked(true);
          else setError(typeof j.error === "string" ? j.error : "No se pudo traducir.");
          return null;
        }
        const lang = isChatLang(j.lang) ? j.lang : null;
        if (j.same || typeof j.text !== "string" || !j.text.trim()) {
          setDraft({ original: body, lang, same: true });
          return null;
        }
        setDraft((d) => ({ original: d?.original ?? body, lang, same: false }));
        return j.text as string;
      } catch {
        setError("Error de red.");
        return null;
      } finally {
        setTranslating(false);
      }
    },
    [opts.listingId, opts.guestSessionId, translating]
  );

  /** Lo que mandar junto con el texto final cuando el borrador se tradujo. */
  const sendMeta = (finalText: string): { original: string; lang?: string } | null =>
    draft && !draft.same && draft.original !== finalText.trim() ? { original: draft.original, lang: draft.lang ?? undefined } : null;

  return {
    translateIn,
    setTranslateIn,
    readingLang,
    setReadingLang,
    locked,
    markLocked: () => setLocked(true),
    draft,
    setDraft,
    translating,
    translateDraft,
    sendMeta,
    error,
  };
}

/** Fila de ajustes: traducir lo que me escriben (sí/no) e idioma en que leo el chat. */
export function TranslatorBar({
  tr,
  lockedHref,
  lockedCta,
  disabled,
}: {
  tr: ReturnType<typeof useWebChatTranslator>;
  lockedHref: string;
  lockedCta: string;
  disabled?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  if (tr.locked) {
    return (
      <p className="text-xs text-amber-800">
        {t("El traductor del chat viene con la membresía de identidad verificada.")}{" "}
        <Link href={lockedHref} className="font-semibold underline">
          {lockedCta}
        </Link>
      </p>
    );
  }
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#666] ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={tr.translateIn} onChange={(e) => tr.setTranslateIn(e.target.checked)} className="accent-[#dcb81e]" />
        {t("Traducir lo que me escriben")}
      </label>
      <label className="flex items-center gap-2">
        <span className="font-semibold">{t("Idioma en que leo el chat")}</span>
        <select
          value={tr.readingLang}
          onChange={(e) => void tr.setReadingLang(e.target.value)}
          className="rounded-lg border border-[#ddd] bg-white px-2 py-1 text-xs outline-none focus:border-[#dcb81e]"
        >
          <option value="">{t("El idioma del sitio ({lang})", { lang: lang === "en" ? "English" : "Español" })}</option>
          {CHAT_LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** Botón «Traducir» junto a Enviar y el aviso de borrador traducido con Deshacer. */
export function DraftTranslateControls({
  tr,
  text,
  onText,
  disabled,
}: {
  tr: ReturnType<typeof useWebChatTranslator>;
  text: string;
  onText: (v: string) => void;
  disabled?: boolean;
}) {
  const t = useT();
  if (tr.locked) return null;
  const undo = () => {
    if (tr.draft && !tr.draft.same) onText(tr.draft.original);
    tr.setDraft(null);
  };
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5c4a0a]">
      <button
        type="button"
        disabled={disabled || tr.translating || !text.trim()}
        onClick={() => void tr.translateDraft(text).then((out) => out && onText(out))}
        className="rounded-full border border-[#dcb81e] px-3 py-1 font-semibold text-[#5c4a0a] disabled:opacity-40"
      >
        {tr.translating ? t("Traduciendo…") : t("Traducir al idioma de la otra persona")}
      </button>
      {tr.draft && text.trim() && (
        <>
          <span>
            {tr.draft.same
              ? t("Ya está en el idioma de la otra persona.")
              : tr.draft.lang
                ? t("Traducido al {lang} · revísalo y envía.", { lang: chatLangName(tr.draft.lang) })
                : t("Traducido · revísalo y envía.")}
          </span>
          <button type="button" onClick={undo} className="font-semibold underline">
            {tr.draft.same ? t("Ocultar") : t("Deshacer")}
          </button>
        </>
      )}
      {tr.error && <span className="text-red-700">{t(tr.error)}</span>}
    </div>
  );
}
