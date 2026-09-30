"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { sizedImage } from "@/lib/image-url";
import { IconClose } from "../../_components/icons";

/** Carrusel de la ficha; al tocar una foto se abre a pantalla completa. */
export function PhotoGallery({ photos, title }: { photos: string[]; title: string }) {
  const t = useT();
  const [open, setOpen] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(null), []);

  const onScroll = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setCurrent(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center bg-[#f3f3f3] text-sm text-[#999]">
        {t("Este anfitrión todavía no sube fotos")}
      </div>
    );
  }

  return (
    <>
      <div
        ref={stripRef}
        onScroll={onScroll}
        className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto bg-[#eee] [scrollbar-width:none]"
      >
        {photos.map((src, i) => (
          <button
            key={`${src}-${i}`}
            type="button"
            onClick={() => setOpen(i)}
            className="h-full w-full shrink-0 snap-center"
            aria-label={t("Ver foto {n} de {total}", { n: i + 1, total: photos.length })}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sizedImage(src, 900)}
              alt={i === 0 ? title : ""}
              className="h-full w-full object-cover"
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              decoding="async"
            />
          </button>
        ))}
      </div>
      {photos.length > 1 && (
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
          {current + 1} / {photos.length}
        </span>
      )}
      {open !== null && <Lightbox photos={photos} start={open} onClose={close} />}
    </>
  );
}

function Lightbox({ photos, start, onClose }: { photos: string[]; start: number; onClose: () => void }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = start * el.clientWidth;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [start, onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black" role="dialog" aria-modal="true">
      <div
        className="flex items-center justify-between px-3 text-white"
        style={{ paddingTop: "calc(8px + env(safe-area-inset-top))", minHeight: "calc(52px + env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
          aria-label={t("Cerrar")}
        >
          <IconClose />
        </button>
        <span className="text-sm font-medium">
          {index + 1} / {photos.length}
        </span>
        <span className="w-10" />
      </div>
      <div
        ref={ref}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
      >
        {photos.map((src, i) => (
          <div key={`${src}-${i}`} className="flex h-full w-full shrink-0 snap-center items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sizedImage(src, 1600, 80)}
              alt=""
              className="max-h-full max-w-full object-contain"
              loading={Math.abs(i - start) <= 1 ? "eager" : "lazy"}
              decoding="async"
            />
          </div>
        ))}
      </div>
      <div style={{ height: "calc(16px + env(safe-area-inset-bottom))" }} />
    </div>
  );
}
