"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";

const THIS_BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "";
const CHECK_EVERY_MS = 5 * 60_000;

/** Avisa cuando hay un deploy nuevo mientras la app sigue abierta (PWA instalada o pestaña vieja). */
export function UpdateBanner() {
  const t = useT();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!THIS_BUILD) return;
    let stopped = false;

    const check = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/app-version", { cache: "no-store" });
        if (!res.ok) return;
        const { build } = (await res.json()) as { build?: string };
        if (build && build !== THIS_BUILD) {
          setAvailable(true);
          navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
        }
      } catch {
        /* sin red: se vuelve a revisar después */
      }
    };

    void check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  if (!available) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[70] flex justify-center px-3"
      style={{ paddingTop: "calc(8px + env(safe-area-inset-top))" }}
    >
      <div className="flex w-full max-w-xl items-center gap-3 rounded-2xl bg-[#111] px-4 py-3 text-white shadow-lg">
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">{t("Nueva versión disponible.")}</span>{" "}
          <span className="text-white/75">{t("Actualiza para ver las mejoras.")}</span>
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-full bg-[#dcb81e] px-4 py-2 text-sm font-semibold text-black"
        >
          {t("Actualizar")}
        </button>
      </div>
    </div>
  );
}
