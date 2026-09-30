"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";

function embedUrl(lat: number, lng: number, span: number) {
  const bbox = [lng - span, lat - span * 0.75, lng + span, lat + span * 0.75].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function ListingMap({ lat, lng }: { lat: number; lng: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <div className="relative h-52 overflow-hidden rounded-2xl border border-[#ebebeb]">
        <iframe
          title={t("Mapa aproximado")}
          width="100%"
          height="100%"
          style={{ border: 0, pointerEvents: "none" }}
          loading="lazy"
          src={embedUrl(lat, lng, 0.02)}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("Ver mapa completo")}
          className="absolute inset-0 flex items-end justify-end p-3"
        >
          <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#222] shadow-[0_2px_10px_rgba(0,0,0,0.18)]">
            {t("Ver mapa completo")}
          </span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white" role="dialog" aria-modal="true">
          <div
            className="flex items-center gap-3 border-b border-[#ebebeb] px-4 pb-3"
            style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("Cerrar")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-2xl leading-none text-[#222] active:bg-[#f3f3f3]"
            >
              ×
            </button>
            <p className="text-base font-semibold text-[#222]">{t("Ubicación aproximada")}</p>
          </div>
          <iframe
            title={t("Mapa aproximado")}
            className="w-full flex-1"
            style={{ border: 0 }}
            src={embedUrl(lat, lng, 0.05)}
          />
          <p
            className="px-4 pt-2 text-xs text-[#717171]"
            style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}
          >
            {t("Pellizca para acercar. La dirección exacta se comparte al confirmar la reserva.")}
          </p>
        </div>
      )}
    </>
  );
}
