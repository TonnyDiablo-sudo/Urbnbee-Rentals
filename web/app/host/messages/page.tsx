"use client";

import { MessageBody } from "@/components/chat/message-body";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale } from "@/lib/i18n";

type Msg = { id: string; sender: "guest" | "host"; body: string; original?: string; createdAt: string; guestName: string };

type Thread = {
  listingId: string;
  listingTitle: string;
  guestSessionId: string;
  guestName: string;
  guestEmail?: string;
  lastAt: string;
  messages: Msg[];
};

export default function HostMessagesPage() {
  const t = useT();
  const lang = useLang();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);

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
    } catch {
      setError("Error de red.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function sendReply(th: Thread) {
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(t(data.error ?? "No se pudo enviar."));
        return;
      }
      setReplyText((prev) => ({ ...prev, [key]: "" }));
      await load();
    } catch {
      alert(t("Error de red."));
    } finally {
      setSending(null);
    }
  }

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
        <ul className="space-y-4">
          {threads.map((th) => {
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
                    <p className="truncate text-xs text-[#aaa]">{th.listingTitle}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-[#888]">{last?.body}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-[#aaa]">
                    {new Date(th.lastAt).toLocaleString(numberLocale(lang), { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </button>

                {open && (
                  <div className="border-t border-[#ebebeb] px-4 py-4">
                    {th.guestEmail && (
                      <p className="mb-3 text-xs text-[#666]">
                        {t("Correo del huésped (opcional):")}{" "}
                        <a className="font-medium text-[#dcb81e] underline" href={`mailto:${th.guestEmail}`}>
                          {th.guestEmail}
                        </a>
                      </p>
                    )}
                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg bg-[#fafafa] p-3">
                      {th.messages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex ${m.sender === "host" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                              m.sender === "host"
                                ? "bg-[#dcb81e] text-black"
                                : "border border-[#ebebeb] bg-white text-[#3a3a3a]"
                            }`}
                          >
                            <span className="text-[10px] font-bold uppercase opacity-70">
                              {m.sender === "host" ? t("Tú") : m.guestName || t("Huésped")}
                            </span>
                            <MessageBody body={m.body} original={m.original} className="mt-0.5 whitespace-pre-wrap" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <textarea
                        value={replyText[key] ?? ""}
                        onChange={(e) =>
                          setReplyText((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        rows={2}
                        maxLength={2000}
                        placeholder={t("Tu respuesta…")}
                        className="min-w-0 flex-1 resize-y rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                      />
                      <button
                        type="button"
                        disabled={sending === key || !(replyText[key] ?? "").trim()}
                        onClick={() => sendReply(th)}
                        className="shrink-0 self-end rounded-full px-4 py-2 text-sm font-semibold text-black shadow disabled:opacity-50"
                        style={{ backgroundColor: "#dcb81e" }}
                      >
                        {sending === key ? "…" : t("Responder")}
                      </button>
                    </div>
                    <Link
                      href={`/host/listings/${th.listingId}/edit`}
                      className="mt-2 inline-block text-xs text-[#dcb81e] underline"
                    >
                      {t("Editar este alojamiento")}
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
