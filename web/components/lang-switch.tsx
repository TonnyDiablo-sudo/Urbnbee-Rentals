"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LANG_COOKIE, type Lang } from "@/lib/i18n";
import { useLang } from "./i18n-provider";

function saveLang(next: Lang) {
  const h = location.hostname;
  const domain = h === "cabibee.com" || h.endsWith(".cabibee.com") ? "; domain=.cabibee.com" : "";
  document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax${domain}`;
  document.documentElement.lang = next;
}

/** Botón ES | EN. Guarda la elección para el sitio y la app. */
export function LangSwitch({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  const lang = useLang();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Lang) {
    if (next === lang) return;
    saveLang(next);
    startTransition(() => router.refresh());
  }

  const base = dark ? "border-white/30 text-white/70" : "border-[#dddddd] text-[#717171]";
  const on = dark ? "bg-white text-black" : "bg-[#111] text-white";

  return (
    <div
      role="group"
      aria-label={lang === "en" ? "Language" : "Idioma"}
      className={`inline-flex shrink-0 overflow-hidden rounded-full border text-xs font-semibold ${base} ${pending ? "opacity-60" : ""} ${className}`}
    >
      {(["es", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          aria-pressed={lang === l}
          className={`touch-manipulation px-3 py-1.5 uppercase ${lang === l ? on : ""}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
