"use client";

import { ChatAttachmentView, type ChatAttachmentClient } from "@/components/chat/attachment-view";
import { MessageBody } from "@/components/chat/message-body";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { VerifyEmailBox } from "@/components/account/purchase-prereqs";
import { useT } from "@/components/i18n-provider";
import { CHAT_LANGS, isChatTranslateTarget, type ChatTranslateTarget } from "@/lib/chat-langs";

type ChatRow = {
  id: string;
  sender: "guest" | "host";
  body: string;
  original?: string;
  attachment?: ChatAttachmentClient;
  createdAt: string;
  guestLabel: string;
};

export function ListingHostChat({
  listingId,
  hostName,
  emailGate,
}: {
  listingId: string;
  hostName: string;
  /** Tiene sesión pero falta confirmar el correo: no puede escribir. */
  emailGate?: { email?: string; placeholder?: boolean };
}) {
  const t = useT();
  const pathname = usePathname();
  const nextEncoded = encodeURIComponent(pathname || "/");

  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [loggedInRaw, setLoggedIn] = useState(false);
  const [needsEmail, setNeedsEmail] = useState(Boolean(emailGate));
  const loggedIn = loggedInRaw && !needsEmail;
  const bottomRef = useRef<HTMLDivElement>(null);
  const [translateTo, setTranslateTo] = useState<ChatTranslateTarget | "">("");
  const [translatorLocked, setTranslatorLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.user) return;
        setLoggedIn(true);
        const u = d.user as { fullName?: string; email?: string };
        if (u.fullName?.trim()) setGuestName(u.fullName.trim());
        if (u.email?.trim()) setGuestEmail(u.email.trim());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/listings/${listingId}/messages`, { credentials: "include" });
      const data = await res.json();
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch {
      setMessages([]);
    } finally {
      setFetching(false);
    }
  }, [listingId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = body.trim();
    if (!text || loading || !loggedIn) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim() || undefined,
          body: text,
          ...(translateTo ? { translateTo } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.needsEmail) {
          setNeedsEmail(true);
        } else if (res.status === 403 && data.translatorLocked) {
          setTranslatorLocked(true);
          setTranslateTo("");
        } else if (res.status === 401 && data.needsLogin) {
          alert(
            typeof data.error === "string"
              ? t(data.error)
              : t("Necesitas una cuenta para enviar mensajes.")
          );
        } else {
          alert(t(data.error ?? "No se pudo enviar."));
        }
        return;
      }
      setBody("");
      await load();
    } catch {
      alert(t("Error de red."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="section-chat-anfitrion" className="rounded-xl border border-[#ebebeb] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[#484848]">{t("Chat con el anfitrión")}</h2>
      <div className="mt-1 h-[3px] w-10" style={{ backgroundColor: "#dcb81e" }} />
      <p className="mt-3 text-xs leading-relaxed text-[#888]">
        {t("Escribe a")} <strong>{hostName}</strong>{" "}
        {t("sobre este alojamiento. Las respuestas las envía el anfitrión (no son automáticas).")}{" "}
        <strong>{t("No compartas contraseñas ni datos bancarios.")}</strong>{" "}
        {t("Cabibee puede revisar mensajes ante reportes de fraude o abuso.")}
      </p>

      {loggedInRaw && needsEmail && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-[#3a3a3a]">{t("Para escribirle al anfitrión confirma tu correo. Así sabemos que la cuenta es tuya.")}</p>
          <VerifyEmailBox email={emailGate?.email} placeholder={emailGate?.placeholder} purpose="message" />
        </div>
      )}

      {!loggedInRaw && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
          <p className="font-medium">{t("Cuenta gratuita para chatear")}</p>
          <p className="mt-1 text-amber-900">
            {t("Para enviar mensajes debes registrarte (sin costo). Así ligamos conversaciones a personas reales y cuidamos a anfitriones y huéspedes. Para reservar y pagar aplicará la verificación de huésped cuando corresponda.")}
          </p>
          <p className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/register?next=${nextEncoded}`}
              className="inline-flex rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-[#222]"
            >
              {t("Registrarse gratis")}
            </Link>
            <Link
              href={`/login?next=${nextEncoded}`}
              className="inline-flex rounded-lg border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100"
            >
              {t("Iniciar sesión")}
            </Link>
          </p>
        </div>
      )}

      <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-[#ebebeb] bg-[#fafafa] p-3">
        {fetching ? (
          <p className="text-sm text-[#aaa]">{t("Cargando conversación…")}</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-[#888]">{t("Aún no hay mensajes. Saluda al anfitrión abajo.")}</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`flex ${m.sender === "guest" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.sender === "guest"
                      ? "rounded-br-sm bg-[#dcb81e] text-black"
                      : "rounded-bl-sm border border-[#ebebeb] bg-white text-[#3a3a3a]"
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    {m.sender === "guest" ? t("Tú") : m.guestLabel}
                  </p>
                  {m.attachment && (
                    <div className="mt-1">
                      <ChatAttachmentView attachment={m.attachment} mine={m.sender === "guest"} />
                    </div>
                  )}
                  {m.body && <MessageBody body={m.body} original={m.original} mine={m.sender === "guest"} className="mt-0.5 whitespace-pre-wrap" />}
                </div>
              </li>
            ))}
            <div ref={bottomRef} />
          </ul>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 opacity-100">
        <label className={`block text-xs font-semibold text-[#666] ${!loggedIn ? "pointer-events-none opacity-50" : ""}`}>
          {t("Traductor del chat")}
          <select
            value={translateTo}
            onChange={(e) => setTranslateTo(isChatTranslateTarget(e.target.value) ? e.target.value : "")}
            disabled={!loggedIn}
            className="mt-1 w-full rounded-lg border border-[#ddd] bg-white px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
          >
            <option value="">{t("Apagado: enviar tal cual")}</option>
            <option value="auto">{t("Automático: idioma de la otra persona")}</option>
            {CHAT_LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
          {translatorLocked ? (
            <span className="mt-1 block font-normal text-amber-800">
              {t("El traductor del chat viene con la membresía de identidad verificada.")}{" "}
              <Link href="/guest/membresia" className="font-semibold underline">
                {t("Ver membresía")}
              </Link>
            </span>
          ) : (
            translateTo && <span className="mt-1 block font-normal text-[#888]">{t("Tu mensaje se envía traducido; el anfitrión puede ver lo que escribiste.")}</span>
          )}
        </label>
        <label className={`block text-xs font-semibold text-[#666] ${!loggedIn ? "pointer-events-none opacity-50" : ""}`}>
          {t("Correo (opcional, para que te respondan fuera de Cabibee)")}
          <input
            type="email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            disabled={!loggedIn}
            className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
            placeholder={t("tu@correo.com")}
            autoComplete="email"
          />
        </label>
      </div>

      <label className={`mt-3 block text-xs font-semibold text-[#666] ${!loggedIn ? "pointer-events-none opacity-50" : ""}`}>
        {t("Mensaje")}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={2000}
          disabled={!loggedIn}
          className="mt-1 w-full resize-y rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
          placeholder={
            loggedIn
              ? t("Hola {name}, tengo una pregunta sobre…", { name: hostName })
              : needsEmail
                ? t("Confirma tu correo para escribir al anfitrión…")
                : t("Inicia sesión para escribir al anfitrión…")
          }
        />
      </label>

      <button
        type="button"
        onClick={send}
        disabled={loading || !loggedIn || !body.trim()}
        className="mt-4 rounded-full px-6 py-2.5 text-sm font-semibold text-black shadow transition hover:brightness-95 disabled:opacity-50"
        style={{ backgroundColor: "#dcb81e" }}
      >
        {loading ? t("Enviando…") : t("Enviar al anfitrión")}
      </button>

      <p className="mt-3 text-[10px] text-[#aaa]">
        {t("El asistente de Cabibee (ventana flotante) responde preguntas generales; este chat es solo entre tú y el anfitrión.")}
      </p>
    </section>
  );
}
