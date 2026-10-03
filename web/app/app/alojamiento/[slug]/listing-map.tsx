"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { PlaceMap } from "@/components/maps/place-map";

export function ListingMap({ lat, lng, exact = false }: { lat: number; lng: number; exact?: boolean }) {
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
      <div className="relative z-0 h-64 overflow-hidden rounded-2xl border border-[#ebebeb] [isolation:isolate]">
        {!open && <PlaceMap lat={lat} lng={lng} zoom={15} interactive={false} exact={exact} />}
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
        <div className="fixed inset-0 z-[80] flex flex-col bg-white" role="dialog" aria-modal="true">
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
            <p className="text-base font-semibold text-[#222]">{exact ? t("Ubicación") : t("Ubicación aproximada")}</p>
          </div>
          <div className="min-h-0 flex-1">
            <PlaceMap lat={lat} lng={lng} zoom={15} exact={exact} />
          </div>
          <p
            className="px-4 pt-2 text-xs text-[#717171]"
            style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}
          >
            {exact
              ? t("Pellizca para acercar.")
              : t("Pellizca para acercar. La dirección exacta se comparte al confirmar la reserva.")}
          </p>
        </div>
      )}
    </>
  );
}
