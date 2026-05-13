"use client";
import { useState, useEffect, useCallback, useRef } from "react";

const slides = [
  {
    n: "01",
    title: "– Directorio de Anfitriones Verificados",
    body: "Reserva con Confianza – Conectamos viajeros con anfitriones verificados, reduciendo el riesgo de fraudes. Cada perfil es revisado para garantizar autenticidad y seguridad.",
    bg: "https://urbnbee.com/wp-content/uploads/2025/02/URBNBEE-CONFIANZA-1920x790.jpeg",
  },
  {
    n: "02",
    title: "– Accede a la Información de los Anfitriones",
    body: "Transparencia Total – Obtén todos los detalles del alojamiento para tomar la mejor decisión. Consulta diferentes formas de contacto y opciones de reserva.",
    bg: "https://urbnbee.com/wp-content/uploads/2025/02/URBNBEE-ALOJAMIENTO-1920x790.jpeg",
  },
  {
    n: "03",
    title: "– Evalúa al Anfitrión con Opiniones Reales",
    body: "Consulta valoraciones y referencias en distintos sitios para tomar una mejor decisión. Transparencia total: revisa la reputación antes de reservar.",
    bg: "https://urbnbee.com/wp-content/uploads/2025/02/URBNBEE-AUTENTICIDAD-1920x790.jpeg",
  },
];

/**
 * Exposes a sentinel div at the bottom of the hero so the SiteHeader can
 * observe when the hero leaves the viewport via a shared IntersectionObserver.
 * We attach the ref to a hidden 1px div at the bottom of the hero section.
 */
export function HeroSlider({ sentinelRef }: { sentinelRef?: React.RefObject<HTMLDivElement | null> }) {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => setCurrent((c) => (c + 1) % slides.length), []);
  const prev = () => setCurrent((c) => (c - 1 + slides.length) % slides.length);

  useEffect(() => {
    const id = setInterval(next, 6000);
    return () => clearInterval(id);
  }, [next]);

  const slide = slides[current];

  return (
    <div className="relative w-full overflow-hidden" style={{ height: "100vh", minHeight: "560px" }}>
      {/* Background images */}
      {slides.map((s, i) => (
        <div
          key={s.n}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{
            backgroundImage: `url(${s.bg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: i === current ? 1 : 0,
          }}
        />
      ))}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/45" />

      {/* Slide content */}
      <div className="relative z-10 flex h-full flex-col justify-center px-6 pb-36 pt-20 sm:px-12 lg:px-24">
        <div className="mb-2 text-sm font-semibold tracking-widest" style={{ color: "#dcb81e" }}>
          {slide.n}
        </div>
        <div className="mb-3 text-sm font-light text-white/70">/por noche aprox.</div>
        <h1 className="mb-5 max-w-xl text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
          {slide.title}
        </h1>
        <p className="max-w-md text-sm font-light leading-relaxed text-white/90 sm:text-base">
          {slide.body}
        </p>
      </div>

      {/* Arrows */}
      <button
        type="button"
        onClick={prev}
        aria-label="Anterior"
        className="absolute left-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full"
        style={{ backgroundColor: "#dcb81e" }}
      >
        <svg className="h-5 w-5 text-black" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Siguiente"
        className="absolute right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full"
        style={{ backgroundColor: "#dcb81e" }}
      >
        <svg className="h-5 w-5 text-black" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Dots */}
      <div className="absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrent(i)}
            aria-label={`Slide ${i + 1}`}
            className="h-2 rounded-full transition-all"
            style={{
              width: i === current ? "24px" : "8px",
              backgroundColor: i === current ? "#dcb81e" : "rgba(255,255,255,0.5)",
            }}
          />
        ))}
      </div>

      {/* Search bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <div className="mx-auto max-w-3xl px-4 pb-6 sm:px-6">
          <div className="flex overflow-hidden rounded shadow-lg">
            <div className="flex flex-1 items-center gap-3 bg-white px-5 py-4">
              <svg className="h-4 w-4 shrink-0" style={{ color: "#dcb81e" }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                placeholder="Ubicación"
                className="w-full bg-transparent text-sm text-[#3a3a3a] outline-none placeholder:text-[#aaa]"
              />
            </div>
            <button
              type="button"
              className="shrink-0 px-10 py-4 text-sm font-semibold text-black transition hover:brightness-90"
              style={{ backgroundColor: "#dcb81e" }}
            >
              Buscar
            </button>
          </div>
          <button
            type="button"
            className="mt-2 block w-full text-center text-xs text-white/60 transition hover:text-white/90"
          >
            Más opciones de búsqueda
          </button>
        </div>
      </div>

      {/* Sentinel: 1px element at the very bottom, observed by SiteHeader */}
      <div ref={sentinelRef} className="absolute bottom-0 left-0 h-px w-full" />
    </div>
  );
}
