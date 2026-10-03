"use client";

import { useRef, useState } from "react";

type Range = { min: number; max: number; histogram: number[] };

function niceStep(span: number): number {
  const raw = span / 100;
  for (const s of [10, 25, 50, 100, 250, 500, 1000]) if (raw <= s) return s;
  return 1000;
}

/**
 * Dos manijas sobre el histograma de precios. undefined en un extremo significa
 * "sin límite", así los anuncios que se publiquen después más caros o más baratos no quedan fuera.
 */
export function PriceRangeSlider({
  range,
  lo,
  hi,
  onChange,
  label,
}: {
  range: Range;
  lo?: number;
  hi?: number;
  onChange: (lo: number | undefined, hi: number | undefined) => void;
  label: { min: string; max: string };
}) {
  const track = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<"lo" | "hi" | null>(null);
  const span = Math.max(1, range.max - range.min);
  const step = niceStep(span);
  const a = Math.min(Math.max(lo ?? range.min, range.min), range.max);
  const b = Math.max(Math.min(hi ?? range.max, range.max), range.min);
  const pct = (v: number) => ((v - range.min) / span) * 100;
  const peak = Math.max(1, ...range.histogram);

  const snap = (v: number) => {
    if (v <= range.min) return range.min;
    if (v >= range.max) return range.max;
    return Math.min(range.max, range.min + Math.round((v - range.min) / step) * step);
  };
  const emit = (nextLo: number, nextHi: number) =>
    onChange(nextLo <= range.min ? undefined : nextLo, nextHi >= range.max ? undefined : nextHi);

  const valueAt = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || r.width === 0) return range.min;
    return snap(range.min + Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * span);
  };
  const move = (which: "lo" | "hi", v: number) => {
    if (which === "lo") emit(Math.min(v, b - step > range.min ? b - step : b), b);
    else emit(a, Math.max(v, a + step < range.max ? a + step : a));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const v = valueAt(e.clientX);
    const pick = a === b ? (v < a ? "lo" : "hi") : Math.abs(v - a) <= Math.abs(v - b) ? "lo" : "hi";
    setDrag(pick);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    move(pick, v);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag) move(drag, valueAt(e.clientX));
  };
  const end = () => setDrag(null);

  const onKey = (which: "lo" | "hi") => (e: React.KeyboardEvent) => {
    const cur = which === "lo" ? a : b;
    const delta = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step : e.key === "ArrowRight" || e.key === "ArrowUp" ? step : 0;
    if (e.key === "Home") return move(which, range.min);
    if (e.key === "End") return move(which, range.max);
    if (!delta) return;
    e.preventDefault();
    move(which, snap(cur + delta));
  };

  const thumb = (which: "lo" | "hi", v: number) => (
    <span
      role="slider"
      tabIndex={0}
      aria-label={which === "lo" ? label.min : label.max}
      aria-valuemin={range.min}
      aria-valuemax={range.max}
      aria-valuenow={v}
      onKeyDown={onKey(which)}
      className={`absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#b0b0b0] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.18)] outline-none transition-transform focus-visible:ring-2 focus-visible:ring-[#222] ${
        drag === which ? "scale-110" : ""
      }`}
      style={{ left: `${pct(v)}%`, zIndex: which === "lo" && a >= range.max - step ? 3 : 2 }}
    />
  );

  return (
    <div className="select-none px-4">
      <div className="flex h-16 items-end gap-[2px]" aria-hidden>
        {range.histogram.map((n, i) => {
          const from = range.min + (i / range.histogram.length) * span;
          const to = range.min + ((i + 1) / range.histogram.length) * span;
          const inside = to > a && from < b;
          return (
            <span
              key={i}
              className={`flex-1 rounded-t-sm ${inside ? "bg-[#222]" : "bg-[#dddddd]"}`}
              style={{ height: n ? `${Math.max(8, (n / peak) * 100)}%` : "2px" }}
            />
          );
        })}
      </div>
      <div
        ref={track}
        className="relative h-10 cursor-pointer touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-[#dddddd]" />
        <span
          className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-[#222]"
          style={{ left: `${pct(a)}%`, width: `${Math.max(0, pct(b) - pct(a))}%` }}
        />
        {thumb("lo", a)}
        {thumb("hi", b)}
      </div>
    </div>
  );
}
