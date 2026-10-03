"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};
const canRecord = () => typeof window.MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

export const VOICE_MAX_SEC = 180;

/** Fotos del celular de 3-8 MB: se reducen a 1600 px en el teléfono para que suban rápido. */
export async function shrinkImage(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return out && out.size < file.size ? out : file;
  } catch {
    return file;
  }
}

const VOICE_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus", "audio/aac"];

export type VoiceRecorder = {
  recording: boolean;
  seconds: number;
  error: string | null;
  supported: boolean;
  start: () => Promise<void>;
  /** Detiene y entrega el audio; con `discard` lo tira. */
  stop: (discard?: boolean) => Promise<{ blob: Blob; seconds: number } | null>;
};

export function useVoiceRecorder(): VoiceRecorder {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<number | null>(null);
  const done = useRef<((v: { blob: Blob; seconds: number } | null) => void) | null>(null);
  const discardRef = useRef(false);
  const supported = useSyncExternalStore(noSubscribe, canRecord, () => false);

  const cleanup = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    rec.current = null;
    setRecording(false);
  }, []);

  useEffect(() => () => {
    discardRef.current = true;
    if (rec.current?.state === "recording") rec.current.stop();
    cleanup();
  }, [cleanup]);

  const stop = useCallback(
    (discard = false) =>
      new Promise<{ blob: Blob; seconds: number } | null>((resolve) => {
        const r = rec.current;
        if (!r || r.state !== "recording") {
          cleanup();
          return resolve(null);
        }
        discardRef.current = discard;
        done.current = resolve;
        r.stop();
      }),
    [cleanup]
  );

  const start = useCallback(async () => {
    setError(null);
    if (!supported) {
      setError("Tu navegador no puede grabar audio.");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const type = VOICE_TYPES.find((m) => MediaRecorder.isTypeSupported(m));
      const r = new MediaRecorder(s, type ? { mimeType: type, audioBitsPerSecond: 32_000 } : undefined);
      chunks.current = [];
      discardRef.current = false;
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        const secs = (Date.now() - startedAt.current) / 1000;
        const blob = new Blob(chunks.current, { type: (r.mimeType || type || "audio/webm").split(";")[0] });
        cleanup();
        const resolve = done.current;
        done.current = null;
        resolve?.(discardRef.current || secs < 0.7 ? null : { blob, seconds: secs });
      };
      stream.current = s;
      rec.current = r;
      startedAt.current = Date.now();
      r.start(250);
      setSeconds(0);
      setRecording(true);
      timer.current = window.setInterval(() => setSeconds((Date.now() - startedAt.current) / 1000), 200);
    } catch {
      cleanup();
      setError("Permite el micrófono para grabar notas de voz.");
    }
  }, [supported, cleanup]);

  return { recording, seconds, error, supported, start, stop };
}
