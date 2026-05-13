"use client";
import Image from "next/image";
import { useState } from "react";

export function PhotoGallery({ photos, title }: { photos: string[]; title: string }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const open = (i: number) => setLightboxIdx(i);
  const close = () => setLightboxIdx(null);
  const prev = () => setLightboxIdx((i) => (i! - 1 + photos.length) % photos.length);
  const next = () => setLightboxIdx((i) => (i! + 1) % photos.length);

  return (
    <>
      {/* Gallery grid */}
      <div className="relative grid h-[400px] grid-cols-4 grid-rows-2 gap-1 sm:h-[500px]">
        {/* Main large photo */}
        <div
          className="col-span-2 row-span-2 cursor-pointer overflow-hidden"
          onClick={() => open(0)}
        >
          <img
            src={photos[0]}
            alt={title}
            className="h-full w-full object-cover transition duration-300 hover:brightness-90"
          />
        </div>
        {/* 4 smaller photos */}
        {photos.slice(1, 5).map((src, i) => (
          <div
            key={i}
            className="cursor-pointer overflow-hidden"
            onClick={() => open(i + 1)}
          >
            <img
              src={src}
              alt={`${title} foto ${i + 2}`}
              className="h-full w-full object-cover transition duration-300 hover:brightness-90"
            />
          </div>
        ))}

        {/* "Ver todas las imágenes" button */}
        <button
          type="button"
          onClick={() => open(0)}
          className="absolute bottom-4 right-4 flex items-center gap-2 rounded border border-white/80 bg-white/90 px-4 py-2 text-sm font-medium text-[#484848] shadow-sm backdrop-blur-sm transition hover:bg-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18" />
          </svg>
          Ver todas las imágenes
        </button>
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95"
          onClick={close}
        >
          {/* Close */}
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Cerrar"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-sm text-white/70">
            {lightboxIdx + 1} / {photos.length}
          </div>

          {/* Image */}
          <div
            className="relative mx-12 max-h-[85vh] max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photos[lightboxIdx]}
              alt={`${title} foto ${lightboxIdx + 1}`}
              className="mx-auto max-h-[85vh] max-w-full rounded object-contain"
            />
          </div>

          {/* Prev / Next */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full text-white transition hover:text-[#dcb81e]"
            aria-label="Anterior"
          >
            <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full text-white transition hover:text-[#dcb81e]"
            aria-label="Siguiente"
          >
            <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Thumbnails strip */}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 overflow-x-auto">
            {photos.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIdx(i); }}
                className="h-14 w-20 shrink-0 overflow-hidden rounded transition"
                style={{ outline: i === lightboxIdx ? `2px solid #dcb81e` : "none" }}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
