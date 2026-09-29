"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconSend } from "./icons";
import { markThreadSeen } from "./seen";
import { TopBar } from "./top-bar";

export type ChatMessage = { id: string; sender: "guest" | "host"; body: string; createdAt: string };

const POLL_MS = 8_000;

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
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
}: {
  title: string;
  subtitle?: string;
  back: string;
  me: "guest" | "host";
  seenKey: string;
  load: () => Promise<ChatMessage[]>;
  send: (text: string) => Promise<string | null>;
  emptyText: string;
  headerRight?: React.ReactNode;
}) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const rows = await load();
      setMessages(rows);
      const last = rows[rows.length - 1];
      markThreadSeen(seenKey, last?.createdAt);
    } catch {
      setMessages((m) => m ?? []);
    }
  }, [load, seenKey]);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => window.clearInterval(t);
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
    setBusy(true);
    setErr(null);
    const error = await send(body);
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    setText("");
    await refresh();
  };

  return (
    <div className="flex h-dvh flex-col">
      <TopBar title={title} back={back} right={headerRight} />
      {subtitle && <p className="border-b border-[#f0f0f0] px-5 py-2 text-xs text-[#717171]">{subtitle}</p>}

      <div className="flex-1 overflow-y-auto bg-[#fafafa] px-4 py-4">
        {messages === null ? (
          <p className="py-10 text-center text-sm text-[#999]">Cargando…</p>
        ) : messages.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm leading-relaxed text-[#717171]">{emptyText}</p>
        ) : (
          <ul className="space-y-2.5">
            {messages.map((m) => {
              const mine = m.sender === me;
              return (
                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug ${
                      mine ? "rounded-br-md bg-[#dcb81e] text-black" : "rounded-bl-md border border-[#ebebeb] bg-white text-[#222]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-black/60" : "text-[#999]"}`}>
                      {timeLabel(m.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={submit}
        className="border-t border-[#ebebeb] bg-white px-3 pt-2.5"
        style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}
      >
        {err && <p className="mb-2 px-2 text-sm text-red-600">{err}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            maxLength={2000}
            placeholder="Escribe un mensaje"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-[#ddd] px-4 py-2.5 text-[15px] outline-none focus:border-[#222]"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#111] text-white disabled:opacity-40"
            aria-label="Enviar"
          >
            <IconSend />
          </button>
        </div>
      </form>
    </div>
  );
}
