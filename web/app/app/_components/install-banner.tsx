"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "cabibee:install-dismissed";

/** Invita a instalar la app. En Android usa el aviso del navegador; en iPhone explica el paso manual. */
export function InstallBanner() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (standalone || dismissed) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(isIos);
    if (isIos) setShow(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  return (
    <div className="mx-4 mt-2 flex items-center gap-3 rounded-2xl bg-[#111] px-4 py-3 text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/app-icons/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Instala Cabibee</p>
        <p className="text-xs text-white/70">
          {ios ? "Toca Compartir y luego «Agregar a inicio»." : "Ábrela como app desde tu pantalla de inicio."}
        </p>
      </div>
      {evt && (
        <button
          type="button"
          onClick={async () => {
            await evt.prompt();
            await evt.userChoice.catch(() => null);
            setEvt(null);
            setShow(false);
          }}
          className="shrink-0 rounded-full bg-[#dcb81e] px-3.5 py-1.5 text-xs font-semibold text-black"
        >
          Instalar
        </button>
      )}
      <button type="button" onClick={dismiss} className="shrink-0 px-1 text-lg leading-none text-white/60" aria-label="Cerrar">
        ×
      </button>
    </div>
  );
}
