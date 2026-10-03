"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/i18n-provider";

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

export function ChatAttachmentView({ attachment, mine }: { attachment: ChatAttachmentClient; mine: boolean }) {
  return attachment.kind === "image" ? <ChatImage a={attachment} /> : <VoiceNote a={attachment} mine={mine} />;
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

function VoiceNote({ a, mine }: { a: ChatAttachmentClient; mine: boolean }) {
  const t = useT();
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(a.durationSec ?? 0);

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audio.current;
    if (!el || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    el.currentTime = Math.min(dur, Math.max(0, ((e.clientX - r.left) / r.width) * dur));
  };
  const pct = dur ? Math.min(100, (pos / dur) * 100) : 0;

  return (
    <div className="flex w-56 max-w-full items-center gap-2.5 py-0.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t("Pausar") : t("Reproducir nota de voz")}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${mine ? "bg-black text-[#dcb81e]" : "bg-[#222] text-white"}`}
      >
        {playing ? (
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
        <div className="relative h-5 cursor-pointer" onClick={seek}>
          <span className={`absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full ${mine ? "bg-black/20" : "bg-[#e3e3e3]"}`} />
          <span
            className={`absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full ${mine ? "bg-black" : "bg-[#222]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className={`text-[11px] ${mine ? "text-black/60" : "text-[#888]"}`}>
          🎤 {clock(playing || pos ? pos : dur)}
        </p>
      </div>
      <audio
        ref={audio}
        src={a.url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPos(0);
        }}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDur(d);
        }}
        className="hidden"
      />
    </div>
  );
}
