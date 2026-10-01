"use client";
import { useState, useRef, useEffect } from "react";
import { useT } from "@/components/i18n-provider";

type Message = { role: "user" | "assistant"; content: string };

function listingChatSessionId(listingId: string): string {
  if (typeof window === "undefined") return "";
  const key = `cabibee_chat_${listingId}`;
  try {
    const existing = window.localStorage.getItem(key);
    if (existing && /^[\w.-]{8,80}$/.test(existing)) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(key, id);
    return id;
  } catch {
    return `s_${Date.now()}`;
  }
}

function BeeMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <ellipse cx="16" cy="26" rx="8" ry="5" fill="#fff" opacity="0.95" transform="rotate(-28 16 26)" />
      <ellipse cx="32" cy="26" rx="8" ry="5" fill="#fff" opacity="0.95" transform="rotate(28 32 26)" />
      <ellipse cx="24" cy="27" rx="11" ry="9" fill="#222" />
      <path d="M16 24h16M16 28h16M16 32h16" stroke="#dcb81e" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="20.5" cy="22.5" r="1.3" fill="#fff" />
      <circle cx="27.5" cy="22.5" r="1.3" fill="#fff" />
      <path d="M21 18c1-3 5-3 6 0" stroke="#dcb81e" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function AiChatWidget({ listingId, listingTitle }: { listingId: string; listingTitle: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [viaBeeagent, setViaBeeagent] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: t("¡Hola! Soy el asistente de Cabibee para \"{title}\". ¿Tienes alguna pregunta?", { title: listingTitle }) },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef("");

  useEffect(() => {
    sessionRef.current = listingChatSessionId(listingId);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/listings/${listingId}/chat`, { cache: "no-store" });
        const data = (await res.json()) as { viaPreferred?: string };
        if (!cancelled && data.viaPreferred === "beeagent") setViaBeeagent(true);
      } catch {
        /* se queda el asistente de Cabibee */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: sessionRef.current }),
      });
      const data = (await res.json()) as { reply?: string; via?: string };
      if (data.via === "beeagent") setViaBeeagent(true);
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? t("No pude procesar tu pregunta.") }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: t("Error al conectar. Intenta más tarde.") }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("Abrir el asistente de Cabibee")}
        className="fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-full bg-[#222] py-2 pl-2 pr-4 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition hover:bg-[#333] active:scale-95"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dcb81e]">
          <BeeMark className="h-7 w-7" />
        </span>
        <span className="text-sm font-semibold">{t("Pregúntame")}</span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-[90] flex w-[min(100vw-2rem,400px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      style={{ height: "min(70dvh, 520px)", border: "1px solid #ebebeb" }}
      role="dialog"
      aria-label={t("Abrir el asistente de Cabibee")}
    >
      <div className="flex shrink-0 items-center gap-3 bg-[#222] px-3 py-2.5 text-white">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dcb81e]">
          <BeeMark className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Cabibee</p>
          <p className="truncate text-[11px] text-white/70">
            {viaBeeagent ? t("Agente del anfitrión (BeeAgent)") : t("Tu asistente de alojamiento")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t("Cerrar")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-white hover:bg-white/10"
        >
          ×
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-[#fafaf8] p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "items-end gap-2"}`}>
            {m.role === "assistant" && (
              <span className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#222]">
                <BeeMark className="h-5 w-5" />
              </span>
            )}
            <div
              className="max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
              style={{
                backgroundColor: m.role === "user" ? "#dcb81e" : "#ffffff",
                color: m.role === "user" ? "#000" : "#3a3a3a",
                border: m.role === "assistant" ? "1px solid #ebebeb" : "none",
                borderBottomRightRadius: m.role === "user" ? 4 : undefined,
                borderBottomLeftRadius: m.role === "assistant" ? 4 : undefined,
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-end gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#222]">
              <BeeMark className="h-5 w-5" />
            </span>
            <div className="rounded-2xl border bg-white px-4 py-3" style={{ borderColor: "#ebebeb" }}>
              <span className="inline-flex gap-1.5">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-[#dcb81e]" style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t bg-white p-3" style={{ borderColor: "#eee" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t("Escribe tu pregunta…")}
          className="flex-1 rounded-full border px-4 py-2 text-sm outline-none transition focus:border-[#222]"
          style={{ borderColor: "#e0e0e0" }}
          disabled={loading}
        />
        <button
          type="button"
          onClick={send}
          disabled={loading || !input.trim()}
          aria-label={t("Buscar")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#222] text-white disabled:opacity-40"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
