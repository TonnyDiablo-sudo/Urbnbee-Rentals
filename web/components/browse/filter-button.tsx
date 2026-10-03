"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLang, useT } from "@/components/i18n-provider";
import {
  AMENITY_FILTERS,
  type BrowseFilters,
  EMPTY_FILTERS,
  activeFilterCount,
  parseBrowseFilters,
  writeBrowseFilters,
} from "@/lib/browse-filters";
import { numberLocale } from "@/lib/i18n";

const PRICE_CAPS = [800, 1500, 2500, 4000];

function Stepper({ label, value, max, onChange }: { label: string; value?: number; max: number; onChange: (n?: number) => void }) {
  const t = useT();
  const n = value ?? 0;
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-[15px] text-[#222]">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(n > 1 ? n - 1 : undefined)}
          disabled={!n}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#bbb] text-lg text-[#222] disabled:opacity-30"
          aria-label={t("Menos")}
        >
          −
        </button>
        <span className="min-w-[78px] text-center text-sm text-[#222]">{n ? `${n}+` : t("Cualquiera")}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, n + 1))}
          disabled={n >= max}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#bbb] text-lg text-[#222] disabled:opacity-30"
          aria-label={t("Más")}
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Botón «Filtros» de la búsqueda: abre el panel y aplica los filtros en la URL. */
export function FilterButton({
  basePath,
  params,
  priceRange,
  className = "",
}: {
  basePath: string;
  /** Parámetros actuales de la búsqueda (q, tipo, vista, verif y filtros). */
  params: Record<string, string>;
  priceRange: { min: number; max: number };
  className?: string;
}) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const initial = useMemo(() => parseBrowseFilters(params), [params]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<BrowseFilters>(initial);
  const [verif, setVerif] = useState(params.verif === "1");
  const [count, setCount] = useState<number | null>(null);
  const active = activeFilterCount(initial) + (params.verif === "1" ? 1 : 0);
  const money = (n: number) => `$${n.toLocaleString(numberLocale(lang))}`;

  const query = useMemo(() => {
    const p = new URLSearchParams();
    for (const k of ["q", "tipo", "vista"]) if (params[k]) p.set(k, params[k]);
    if (verif) p.set("verif", "1");
    return writeBrowseFilters(f, p).toString();
  }, [f, verif, params]);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/listings/count?${query}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: { count?: number }) => setCount(typeof d.count === "number" ? d.count : null))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [open, query]);

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

  const openPanel = () => {
    setF(initial);
    setVerif(params.verif === "1");
    setCount(null);
    setOpen(true);
  };
  const apply = () => {
    setOpen(false);
    router.push(query ? `${basePath}?${query}` : basePath);
  };
  const set = (patch: Partial<BrowseFilters>) => setF((cur) => ({ ...cur, ...patch }));
  const toggleAmenity = (key: string) =>
    set({ amenities: f.amenities.includes(key) ? f.amenities.filter((k) => k !== key) : [...f.amenities, key] });
  const priceNumber = (v: string) => {
    const n = Math.floor(Number(v.replace(/[^\d]/g, "")));
    return n > 0 ? n : undefined;
  };

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className={`relative flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold ${
          active ? "border-[#222] bg-[#f7f7f7] text-[#222]" : "border-[#e0e0e0] bg-white text-[#222]"
        } ${className}`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
        {t("Filtros")}
        {active > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#222] px-1 text-[11px] text-white">
            {active}
          </span>
        )}
      </button>

      {open &&
        createPortal(
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("Filtros")}
            className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-white sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex items-center justify-center border-b border-[#f0f0f0] px-5 py-4">
              <h2 className="text-base font-semibold text-[#222]">{t("Filtros")}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-3 flex h-9 w-9 items-center justify-center rounded-full text-xl text-[#555] hover:bg-[#f5f5f5]"
                aria-label={t("Cerrar")}
              >
                ×
              </button>
            </div>

            <div className="divide-y divide-[#eee] overflow-y-auto px-5">
              <section className="py-5">
                <h3 className="text-lg font-semibold text-[#222]">{t("Precio por noche")}</h3>
                {priceRange.max > 0 && (
                  <p className="mt-0.5 text-[13px] text-[#717171]">
                    {t("Van de {min} a {max} MXN", { min: money(priceRange.min), max: money(priceRange.max) })}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="rounded-xl border border-[#bbb] px-3 py-2">
                    <span className="block text-[11px] text-[#717171]">{t("Mínimo")}</span>
                    <input
                      inputMode="numeric"
                      value={f.min ?? ""}
                      onChange={(e) => set({ min: priceNumber(e.target.value) })}
                      placeholder="$0"
                      className="w-full bg-transparent text-[15px] text-[#222] outline-none"
                    />
                  </label>
                  <label className="rounded-xl border border-[#bbb] px-3 py-2">
                    <span className="block text-[11px] text-[#717171]">{t("Máximo")}</span>
                    <input
                      inputMode="numeric"
                      value={f.max ?? ""}
                      onChange={(e) => set({ max: priceNumber(e.target.value) })}
                      placeholder={t("Sin tope")}
                      className="w-full bg-transparent text-[15px] text-[#222] outline-none"
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PRICE_CAPS.map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => set({ max: f.max === cap ? undefined : cap })}
                      className={`rounded-full border px-3 py-1.5 text-[13px] ${
                        f.max === cap ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] text-[#222]"
                      }`}
                    >
                      {t("Hasta {n}", { n: money(cap) })}
                    </button>
                  ))}
                </div>
              </section>

              <section className="py-5">
                <h3 className="text-lg font-semibold text-[#222]">{t("Tipo de espacio")}</h3>
                <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-xl border border-[#ddd] text-sm">
                  {(
                    [
                      [undefined, "Cualquiera"],
                      ["completo", "Espacio completo"],
                      ["habitacion", "Habitación"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => set({ space: key })}
                      className={`px-2 py-3 ${f.space === key ? "bg-[#222] font-semibold text-white" : "text-[#222]"}`}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>
              </section>

              <section className="py-3">
                <Stepper label={t("Huéspedes")} value={f.guests} max={16} onChange={(n) => set({ guests: n })} />
                <Stepper label={t("Recámaras")} value={f.bedrooms} max={10} onChange={(n) => set({ bedrooms: n })} />
              </section>

              <section className="py-5">
                <h3 className="text-lg font-semibold text-[#222]">{t("Comodidades")}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {AMENITY_FILTERS.map((a) => {
                    const on = f.amenities.includes(a.key);
                    return (
                      <button
                        key={a.key}
                        type="button"
                        onClick={() => toggleAmenity(a.key)}
                        aria-pressed={on}
                        className={`rounded-full border px-3.5 py-2 text-[13px] ${
                          on ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] text-[#222]"
                        }`}
                      >
                        {t(a.label)}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-1 py-4">
                {(
                  [
                    [f.bookable, () => set({ bookable: !f.bookable }), "Reserva en Cabibee", "Reservas y pagas aquí, con contrato."],
                    [verif, () => setVerif(!verif), "Anfitrión verificado", "Comprobó su identidad con Cabibee."],
                  ] as const
                ).map(([on, toggle, label, hint]) => (
                  <button key={label} type="button" onClick={toggle} className="flex w-full items-center justify-between gap-4 py-2 text-left">
                    <span>
                      <span className="block text-[15px] text-[#222]">{t(label)}</span>
                      <span className="block text-[13px] text-[#717171]">{t(hint)}</span>
                    </span>
                    <span
                      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-[#222]" : "bg-[#ddd]"}`}
                      aria-hidden
                    >
                      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${on ? "left-[22px]" : "left-0.5"}`} />
                    </span>
                  </button>
                ))}
              </section>
            </div>

            <div
              className="flex items-center justify-between gap-3 border-t border-[#eee] px-5 py-3"
              style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
            >
              <button
                type="button"
                onClick={() => {
                  setF(EMPTY_FILTERS);
                  setVerif(false);
                }}
                className="text-[15px] font-semibold text-[#222] underline"
              >
                {t("Quitar todo")}
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={count === 0}
                className="rounded-xl bg-[#222] px-5 py-3 text-[15px] font-semibold text-white disabled:opacity-40"
              >
                {count === null
                  ? t("Mostrar alojamientos")
                  : count === 0
                    ? t("Ningún alojamiento")
                    : t(count === 1 ? "Mostrar 1 alojamiento" : "Mostrar {n} alojamientos", { n: count })}
              </button>
            </div>
          </div>
        </div>,
          document.body
        )}
    </>
  );
}
