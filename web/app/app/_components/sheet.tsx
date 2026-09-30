"use client";

import { useEffect } from "react";
import { useT } from "@/components/i18n-provider";

/** Panel que sube desde abajo, a la manera de las hojas de iOS/Android. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center border-b border-[#f0f0f0] px-5 py-4">
          <span className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-[#ddd]" />
          <h2 className="text-base font-semibold text-[#222]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 flex h-9 w-9 items-center justify-center rounded-full text-xl text-[#555] hover:bg-[#f5f5f5]"
            aria-label={t("Cerrar")}
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5" style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
