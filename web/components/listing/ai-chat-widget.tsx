"use client";
import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };

// Frame sequence: type → type → type → sip coffee → put cup down → type …
const FRAMES = [
  { src: "/bee-desk.png",   dur: 2200 },  // typing
  { src: "/bee-desk.png",   dur: 1800 },  // typing
  { src: "/bee-coffee.png", dur: 1600 },  // sip coffee
  { src: "/bee-desk.png",   dur: 400  },  // back to desk (transition)
  { src: "/bee-desk.png",   dur: 2000 },  // typing again
];

export function AiChatWidget({ listingId, listingTitle }: { listingId: string; listingTitle: string }) {
  const [open, setOpen]               = useState(false);
  const [bubbleVisible, setBubbleVisible] = useState(true);
  const [bubbleFading,  setBubbleFading]  = useState(false);
  const [frameIdx,      setFrameIdx]      = useState(0);
  const [imgVisible,    setImgVisible]    = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: `¡Hola! 🐝 Soy BeeBot, tu asistente para "${listingTitle}". ¿Tienes alguna pregunta?` },
  ]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Frame animation loop ──
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => {
      setImgVisible(false);                          // fade out
      timer = setTimeout(() => {
        setFrameIdx((i) => (i + 1) % FRAMES.length);
        setImgVisible(true);                         // fade in next frame
        timer = setTimeout(advance, FRAMES[(frameIdx + 1) % FRAMES.length].dur);
      }, 220);
    };
    timer = setTimeout(advance, FRAMES[frameIdx].dur);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameIdx]);

  // ── Auto-fade speech bubble ──
  useEffect(() => {
    const t1 = setTimeout(() => setBubbleFading(true),  5400);
    const t2 = setTimeout(() => setBubbleVisible(false), 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const handleOpen = () => {
    setOpen((v) => !v);
    setBubbleFading(true);
    setTimeout(() => setBubbleVisible(false), 300);
  };

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
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? "No pude procesar tu pregunta." }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Error al conectar. Intenta más tarde." }]);
    } finally {
      setLoading(false);
    }
  };

  const currentSrc = FRAMES[frameIdx].src;

  return (
    <>
      <style>{`
        /* ── Idle hover float ── */
        @keyframes bee-idle {
          0%,100% { transform: translateY(0) rotate(-1deg); }
          50%      { transform: translateY(-9px) rotate(1deg); }
        }
        /* ── Pulse ring ── */
        @keyframes pulse-ring {
          0%   { transform: scale(0.82); opacity: 0.6; }
          70%  { transform: scale(1.4);  opacity: 0; }
          100% { transform: scale(1.4);  opacity: 0; }
        }
        /* ── Label bounce ── */
        @keyframes label-bounce {
          0%,100% { transform: translateY(0); }
          40%     { transform: translateY(-5px); }
          70%     { transform: translateY(-2px); }
        }
        /* ── Bubble pop / fade ── */
        @keyframes bubble-pop {
          0%   { opacity:0; transform:scale(.5) translateY(14px); }
          65%  { opacity:1; transform:scale(1.05) translateY(-3px); }
          100% { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes bubble-fade {
          to { opacity:0; transform:translateY(-8px) scale(.95); }
        }
        /* ── Img cross-fade ── */
        @keyframes img-in  { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
        @keyframes img-out { from{opacity:1} to{opacity:0} }

        .bee-idle       { animation: bee-idle 3s ease-in-out infinite; }
        .bee-pulse      { animation: pulse-ring 1.9s cubic-bezier(.4,0,.6,1) infinite; }
        .label-bounce   { animation: label-bounce 2.4s ease-in-out infinite; }
        .bubble-pop     { animation: bubble-pop  .45s cubic-bezier(.34,1.56,.64,1) forwards; }
        .bubble-fade    { animation: bubble-fade .35s ease forwards; }
        .bee-img-in     { animation: img-in  .22s ease forwards; }
        .bee-img-out    { animation: img-out .22s ease forwards; }
      `}</style>

      {/* ══════════════════════════════════════════
          Floating widget (bottom-right)
      ══════════════════════════════════════════ */}
      <div className="fixed bottom-5 right-5 z-[90] flex flex-col items-center gap-2 select-none">

        {/* ── Speech bubble (auto-hides) ── */}
        {bubbleVisible && !open && (
          <div className={`relative ${bubbleFading ? "bubble-fade" : "bubble-pop"}`}>
            <div
              className="rounded-2xl bg-white px-5 py-3 text-center shadow-2xl"
              style={{ border: "2.5px solid #dcb81e", minWidth: 190 }}
            >
              <p className="text-sm font-extrabold text-[#3a3a3a]">¿En qué puedo ayudarte? 🐝</p>
              <p className="mt-1 text-xs text-[#888]">Soy BeeBot, tu asistente</p>
              <button
                onClick={handleOpen}
                className="mt-2 rounded-full px-4 py-1 text-xs font-bold text-black transition hover:brightness-90 active:scale-95"
                style={{ backgroundColor: "#dcb81e" }}
              >
                ¡Pregúntame! →
              </button>
            </div>
            <span className="absolute -bottom-[11px] left-1/2 -translate-x-1/2 h-0 w-0"
              style={{ borderLeft:"10px solid transparent", borderRight:"10px solid transparent", borderTop:"11px solid #dcb81e" }} />
            <span className="absolute -bottom-[8px] left-1/2 -translate-x-1/2 h-0 w-0"
              style={{ borderLeft:"9px solid transparent", borderRight:"9px solid transparent", borderTop:"10px solid white" }} />
          </div>
        )}

        {/* ── "Pregúntame" label tag ── */}
        {!open && (
          <div
            className="label-bounce rounded-full px-4 py-1.5 text-xs font-extrabold text-black shadow-lg tracking-wide"
            style={{ backgroundColor: "#dcb81e", letterSpacing: "0.04em" }}
          >
            🐝 Pregúntame
          </div>
        )}

        {/* ── Bee + pulse ring ── */}
        <div className="relative flex items-center justify-center" style={{ width: 170, height: 170 }}>
          {/* Pulse ring (only when closed) */}
          {!open && (
            <div className="bee-pulse absolute inset-0 rounded-full"
              style={{ backgroundColor: "rgba(220,184,30,.3)" }} />
          )}

          {/* Bee button */}
          <button
            type="button"
            onClick={handleOpen}
            aria-label="Abrir chat con BeeBot"
            className="bee-idle relative focus:outline-none"
            style={{ width: 160, height: 160, background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            {/* Close X */}
            {open && (
              <div className="absolute -right-1 -top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full shadow-lg"
                style={{ backgroundColor: "#dcb81e" }}>
                <svg className="h-4 w-4 text-black" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}

            {/* Animated frame image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={currentSrc + frameIdx}
              src={currentSrc}
              alt="BeeBot"
              className={`h-full w-full object-contain drop-shadow-2xl ${imgVisible ? "bee-img-in" : "bee-img-out"}`}
              draggable={false}
            />
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          Chat panel
      ══════════════════════════════════════════ */}
      {open && (
        <div
          className="fixed bottom-5 right-48 z-[90] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:w-[400px] w-80"
          style={{ height: 460, border: "2.5px solid #dcb81e" }}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 px-4 py-3"
            style={{ background: "linear-gradient(90deg,#dcb81e 0%,#f5d84e 100%)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bee-desk.png" alt="" className="h-12 w-12 shrink-0 object-contain" draggable={false} />
            <div>
              <p className="text-sm font-extrabold text-black">BeeBot</p>
              <p className="text-[11px] text-black/55">Tu asistente de alojamiento</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500 shadow" />
              <span className="text-[11px] font-medium text-black/50">En línea</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-[#fafaf8] p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "items-end gap-2"}`}>
                {m.role === "assistant" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/bee-desk.png" alt="" className="mb-0.5 h-8 w-8 shrink-0 object-contain" draggable={false} />
                )}
                <div
                  className="max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                  style={{
                    backgroundColor: m.role === "user" ? "#dcb81e" : "#ffffff",
                    color: m.role === "user" ? "#000" : "#3a3a3a",
                    border: m.role === "assistant" ? "1px solid #ebebeb" : "none",
                    borderBottomRightRadius: m.role === "user" ? 4 : undefined,
                    borderBottomLeftRadius:  m.role === "assistant" ? 4 : undefined,
                    boxShadow: m.role === "assistant" ? "0 1px 4px rgba(0,0,0,.06)" : "none",
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-end gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/bee-coffee.png" alt="" className="h-8 w-8 shrink-0 object-contain" draggable={false} />
                <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm" style={{ borderColor: "#ebebeb" }}>
                  <span className="inline-flex gap-1.5">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="h-2 w-2 rounded-full bg-[#dcb81e] animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex shrink-0 items-center gap-2 border-t bg-white p-3"
            style={{ borderColor: "#f0e8c8" }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Escribe tu pregunta…"
              className="flex-1 rounded-full border px-4 py-2 text-sm outline-none transition focus:border-[#dcb81e] focus:ring-2 focus:ring-[#dcb81e]/20"
              style={{ borderColor: "#e0e0e0" }}
              disabled={loading}
            />
            <button
              type="button"
              onClick={send}
              disabled={loading || !input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:brightness-90 active:scale-95 disabled:opacity-40"
              style={{ backgroundColor: "#dcb81e" }}
            >
              <svg className="h-4 w-4 text-black" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
