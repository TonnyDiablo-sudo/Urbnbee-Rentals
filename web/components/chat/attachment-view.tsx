"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/i18n-provider";
import { MessageBody } from "@/components/chat/message-body";

export type ChatAttachmentClient = {
  url: string;
  kind: "image" | "audio";
  durationSec?: number;
  width?: number;
  height?: number;
};

function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ChatAttachmentView({
  attachment,
  mine,
  transcript,
  transcriptOriginal,
}: {
  attachment: ChatAttachmentClient;
  mine: boolean;
  /** Transcripción de la nota de voz (ya traducida al idioma de quien lee, si aplica). */
  transcript?: string;
  transcriptOriginal?: string;
}) {
  if (attachment.kind === "image") return <ChatImage a={attachment} />;
  return (
    <>
      <VoiceNote a={attachment} mine={mine} />
      {transcript && (
        <div className={`mt-1 border-t pt-1.5 text-[13px] italic leading-snug ${mine ? "border-black/10 text-black/75" : "border-[#eee] text-[#555]"}`}>
          <MessageBody body={transcript} original={transcriptOriginal} className="whitespace-pre-wrap break-words" />
        </div>
      )}
    </>
  );
}

function ChatImage({ a }: { a: ChatAttachmentClient }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ratio = a.width && a.height ? a.width / a.height : 4 / 3;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block overflow-hidden rounded-xl" aria-label={t("Ver foto")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- archivo privado servido con sesión */}
        <img
          src={a.url}
          alt={t("Foto")}
          loading="lazy"
          className="block max-h-72 w-60 max-w-full bg-black/5 object-cover"
          style={{ aspectRatio: String(Math.min(1.6, Math.max(0.6, ratio))) }}
        />
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90" onClick={() => setOpen(false)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- archivo privado servido con sesión */}
            <img src={a.url} alt={t("Foto")} className="max-h-full max-w-full object-contain" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-[calc(12px+env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl text-white"
              aria-label={t("Cerrar")}
            >
              ×
            </button>
          </div>,
          document.body
        )}
    </>
  );
}

const SPEEDS = [1, 1.5, 2];

/** Nota de voz como en WhatsApp: se arrastra la bolita para adelantar o regresar y se cambia la velocidad. */
export function VoiceNote({ a, mine = false, wide = false }: { a: Pick<ChatAttachmentClient, "url" | "durationSec">; mine?: boolean; wide?: boolean }) {
  const t = useT();
  const audio = useRef<HTMLAudioElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(a.durationSec ?? 0);
  const [dragging, setDragging] = useState(false);
  const [speed, setSpeed] = useState(1);
  /** WebM de Chrome llega sin duración: se brinca al final para que el navegador la calcule. */
  const fixing = useRef(false);

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) {
      setLoading(el.readyState < 3);
      void el.play().catch(() => {
        setPlaying(false);
        setLoading(false);
      });
    } else el.pause();
  };
  const timeAt = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || !dur) return 0;
    return Math.min(dur, Math.max(0, ((clientX - r.left) / r.width) * dur));
  };
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dur) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setPos(timeAt(e.clientX));
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging) setPos(timeAt(e.clientX));
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    const el = audio.current;
    const at = timeAt(e.clientX);
    setPos(at);
    if (el) el.currentTime = at;
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = audio.current;
    if (!el || !dur) return;
    const step = e.key === "ArrowRight" ? 5 : e.key === "ArrowLeft" ? -5 : 0;
    if (!step) return;
    e.preventDefault();
    el.currentTime = Math.min(dur, Math.max(0, el.currentTime + step));
    setPos(el.currentTime);
  };
  const nextSpeed = () => {
    const s = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(s);
    if (audio.current) audio.current.playbackRate = s;
  };
  const pct = dur ? Math.min(100, (pos / dur) * 100) : 0;

  return (
    <div className={`flex ${wide ? "w-full" : "w-64"} max-w-full items-center gap-2.5 py-0.5`}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t("Pausar") : t("Reproducir nota de voz")}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${mine ? "bg-black text-[#dcb81e]" : "bg-[#222] text-white"}`}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
        ) : playing ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          ref={track}
          role="slider"
          tabIndex={0}
          aria-label={t("Posición de la nota de voz")}
          aria-valuemin={0}
          aria-valuemax={Math.round(dur)}
          aria-valuenow={Math.round(pos)}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => setDragging(false)}
          onKeyDown={onKey}
          className="relative h-8 cursor-pointer touch-none select-none"
        >
          <span className={`absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full ${mine ? "bg-black/20" : "bg-[#e3e3e3]"}`} />
          <span
            className={`absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full ${mine ? "bg-black" : "bg-[#222]"}`}
            style={{ width: `${pct}%` }}
          />
          <span
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full shadow ${mine ? "bg-black" : "bg-[#222]"} ${
              dragging ? "h-5 w-5" : "h-3.5 w-3.5"
            }`}
            style={{ left: `${pct}%` }}
          />
        </div>
        <p className={`-mt-1 flex items-center justify-between text-[11px] ${mine ? "text-black/60" : "text-[#888]"}`}>
          <span>🎤 {clock(playing || pos ? pos : dur)}</span>
          {dur > 0 && <span>{clock(dur)}</span>}
        </p>
      </div>
      <button
        type="button"
        onClick={nextSpeed}
        aria-label={t("Velocidad")}
        className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${mine ? "bg-black/10 text-black" : "bg-[#f0f0f0] text-[#222]"}`}
      >
        {speed}×
      </button>
      <audio
        ref={audio}
        src={a.url}
        preload="metadata"
        playsInline
        onPlay={() => setPlaying(true)}
        onPlaying={() => setLoading(false)}
        onWaiting={() => setLoading(true)}
        onPause={() => {
          setPlaying(false);
          setLoading(false);
        }}
        onEnded={() => {
          setPlaying(false);
          setPos(0);
        }}
        onTimeUpdate={(e) => !dragging && !fixing.current && setPos(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          el.playbackRate = speed;
          if (Number.isFinite(el.duration) && el.duration > 0) setDur(el.duration);
          else {
            fixing.current = true;
            el.currentTime = 1e101;
          }
        }}
        onDurationChange={(e) => {
          const el = e.currentTarget;
          if (!Number.isFinite(el.duration) || el.duration <= 0) return;
          setDur(el.duration);
          if (fixing.current) {
            fixing.current = false;
            el.currentTime = 0;
          }
        }}
        className="hidden"
      />
    </div>
  );
}
