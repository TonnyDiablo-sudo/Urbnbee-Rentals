"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";

export const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: "Limpieza", emojis: ["🧹", "🧽", "🧼", "🫧", "🧴", "🪣", "🧺", "🗑️", "♻️", "🧤", "🪥", "🫙", "🧯", "🪒", "🦠", "✨"] },
  { label: "Baño", emojis: ["🧻", "🚽", "🚿", "🛁", "🪞", "💈", "🧖", "💧", "🌸", "🌿"] },
  { label: "Recámara", emojis: ["🛏️", "🛋️", "🪟", "🪑", "🧸", "👕", "🧦", "🩴", "🧳", "💡", "🔦", "🔋", "🕯️", "🪫"] },
  { label: "Cocina", emojis: ["☕", "🫖", "🍵", "🥛", "🧃", "🥤", "🍶", "🍷", "🍺", "🧂", "🍳", "🥄", "🍴", "🔪", "🍽️", "🥣", "🧊", "🍞", "🥚", "🍯", "🍬", "🍫", "🍪", "🍎", "🍌", "💊"] },
  { label: "Casa", emojis: ["🔑", "🗝️", "🔒", "🚪", "🏠", "🏡", "🌡️", "❄️", "🔥", "🔌", "📶", "📺", "🎮", "🧰", "🔧", "🔨", "🪛", "🪜", "🧲", "📦", "🛒", "🏷️"] },
  { label: "Exterior", emojis: ["🏊", "🌴", "🌵", "🌻", "🪴", "🌳", "🐶", "🐱", "🚗", "🅿️", "🚲", "⛱️", "🔆", "🌧️"] },
  { label: "Chats", emojis: ["💬", "💰", "🗓️", "📋", "📢", "⭐", "❤️", "✅", "⚠️", "🚨", "📸", "🎉", "🤝", "👥", "🐝", "🙌"] },
];

/** Botón con el ícono elegido; al tocarlo abre una cuadrícula de íconos para escoger. */
export function EmojiPicker({ value, onChange, size = "md" }: { value: string; onChange: (emoji: string) => void; size?: "sm" | "md" }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("Elegir ícono")}
        className={`shrink-0 rounded-xl border border-[#ddd] bg-white text-center ${size === "sm" ? "h-9 w-11 text-lg" : "h-11 w-14 text-2xl"}`}
      >
        {value || "📦"}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[75vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold text-[#222]">{t("Elige un ícono")}</p>
              <button type="button" onClick={() => setOpen(false)} aria-label={t("Cerrar")} className="text-xl text-[#555]">
                ×
              </button>
            </div>
            {EMOJI_GROUPS.map((g) => (
              <div key={g.label} className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">{t(g.label)}</p>
                <div className="mt-1.5 grid grid-cols-8 gap-1">
                  {g.emojis.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        onChange(e);
                        setOpen(false);
                      }}
                      className={`flex aspect-square items-center justify-center rounded-lg text-2xl transition hover:bg-[#f3f3f3] ${
                        value === e ? "bg-[#fff6d6] ring-1 ring-[#dcb81e]" : ""
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
