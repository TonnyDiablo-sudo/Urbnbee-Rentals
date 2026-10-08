"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useT } from "@/components/i18n-provider";
import { deviceFromUa } from "@/lib/device";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const noop = () => () => {};

/** Registra el service worker de la app de asociados (necesario para instalarla en Android). */
export function AssociatePwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/asociados-sw.js", { scope: "/asociados", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}

/** En Android, si todavía no instaló la app, le ofrece instalarla para recibir anuncios desde Compartir. */
export function AndroidShareBanner() {
  const t = useT();
  const onPhonePage = usePathname() === "/asociados/celular";
  const show = useSyncExternalStore(
    noop,
    () => deviceFromUa(navigator.userAgent) === "android" && !isStandalone() && localStorage.getItem("cb-assoc-banner") !== "off",
    () => false
  );
  const [hidden, setHidden] = useState(false);
  if (!show || hidden || onPhonePage) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-2.5 text-sm text-amber-900">
        <span className="text-lg">📲</span>
        <p className="flex-1">{t("Instala Cabibee Asociados y mándale anuncios desde el botón Compartir de Facebook o de tu galería.")}</p>
        <Link href="/asociados/celular" className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white">
          {t("Ver cómo")}
        </Link>
        <button
          type="button"
          aria-label={t("Cerrar")}
          onClick={() => {
            localStorage.setItem("cb-assoc-banner", "off");
            setHidden(true);
          }}
          className="shrink-0 px-1 text-amber-700"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/** Botón "Instalar" de Chrome Android; si el navegador no lo ofrece se muestran los pasos a mano. */
export function InstallAppButton() {
  const t = useT();
  const canPrompt = useSyncExternalStore(subscribe, () => Boolean(deferred), () => false);
  const installed = useSyncExternalStore(noop, isStandalone, () => false);
  const [done, setDone] = useState(false);

  if (installed) {
    return (
      <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
        ✓ {t("Ya estás en la app instalada. Ya puedes compartirle anuncios.")}
      </p>
    );
  }
  if (done) {
    return <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">✓ {t("Listo, quedó instalada.")}</p>;
  }
  if (!canPrompt) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        const p = deferred;
        if (!p) return;
        await p.prompt();
        const { outcome } = await p.userChoice;
        deferred = null;
        emit();
        if (outcome === "accepted") setDone(true);
      }}
      className="w-full rounded-lg bg-amber-500 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-600 sm:w-auto"
    >
      📲 {t("Instalar Cabibee Asociados")}
    </button>
  );
}
