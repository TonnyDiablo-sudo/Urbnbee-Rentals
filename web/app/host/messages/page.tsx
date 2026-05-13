"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Msg = { id: string; sender: "guest" | "host"; body: string; createdAt: string; guestName: string };

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

  async function sendReply(t: Thread) {
    const key = `${t.listingId}:${t.guestSessionId}`;
    const body = (replyText[key] ?? "").trim();
    if (!body || sending) return;
    setSending(key);
    try {
      const res = await fetch("/api/host/inbox/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          listingId: t.listingId,
          guestSessionId: t.guestSessionId,
          body,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "No se pudo enviar.");
        return;
      }
      setReplyText((prev) => ({ ...prev, [key]: "" }));
      await load();
    } catch {
      alert("Error de red.");
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#484848]">Mensajes de huéspedes</h1>
        <p className="mt-1 text-sm text-[#888]">
          Conversaciones iniciadas desde la ficha pública.{" "}
          <strong className="font-medium text-[#666]">
            No pidas ni envíes pagos fuera de los canales oficiales de Urbnbee cuando existan.
          </strong>
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[#888]">Cargando…</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : threads.length === 0 ? (
        <div className="rounded-xl border border-[#ebebeb] bg-white p-10 text-center text-sm text-[#888] shadow-sm">
          Nadie ha escrito todavía en el chat de tus alojamientos.
        </div>
      ) : (
        <ul className="space-y-4">
          {threads.map((t) => {
            const key = `${t.listingId}:${t.guestSessionId}`;
            const open = expanded === key;
            const last = t.messages[t.messages.length - 1];
            return (
              <li key={key} className="overflow-hidden rounded-xl border border-[#ebebeb] bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : key)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#fafafa]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#484848]">{t.guestName}</p>
                    <p className="truncate text-xs text-[#aaa]">{t.listingTitle}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-[#888]">{last?.body}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-[#aaa]">
                    {new Date(t.lastAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </button>

                {open && (
                  <div className="border-t border-[#ebebeb] px-4 py-4">
                    {t.guestEmail && (
                      <p className="mb-3 text-xs text-[#666]">
                        Correo del huésped (opcional):{" "}
                        <a className="font-medium text-[#dcb81e] underline" href={`mailto:${t.guestEmail}`}>
                          {t.guestEmail}
                        </a>
                      </p>
                    )}
                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg bg-[#fafafa] p-3">
                      {t.messages.map((m) => (
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
                              {m.sender === "host" ? "Tú" : m.guestName || "Huésped"}
                            </span>
                            <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
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
                        placeholder="Tu respuesta…"
                        className="min-w-0 flex-1 resize-y rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                      />
                      <button
                        type="button"
                        disabled={sending === key || !(replyText[key] ?? "").trim()}
                        onClick={() => sendReply(t)}
                        className="shrink-0 self-end rounded-full px-4 py-2 text-sm font-semibold text-black shadow disabled:opacity-50"
                        style={{ backgroundColor: "#dcb81e" }}
                      >
                        {sending === key ? "…" : "Responder"}
                      </button>
                    </div>
                    <Link
                      href={`/host/listings/${t.listingId}/edit`}
                      className="mt-2 inline-block text-xs text-[#dcb81e] underline"
                    >
                      Editar este alojamiento
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
