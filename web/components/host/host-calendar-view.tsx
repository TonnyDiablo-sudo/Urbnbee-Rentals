"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HostListingRecord } from "@/lib/marketplace-types";

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const DOW_LETTER = ["D", "L", "M", "X", "J", "V", "S"] as const;

function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysInMonth(year: number, month: number): Date[] {
  const out: Date[] = [];
  const last = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= last; day++) {
    out.push(new Date(year, month, day));
  }
  return out;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);
}

function priceForNight(listing: HostListingRecord, iso: string): number {
  const o = listing.nightlyPriceOverrides?.[iso];
  if (typeof o === "number" && Number.isFinite(o)) return o;
  return listing.pricePerNight;
}

type Rect = { rowMin: number; rowMax: number; colMin: number; colMax: number };

function normalizeRect(a: { row: number; col: number }, b: { row: number; col: number }): Rect {
  return {
    rowMin: Math.min(a.row, b.row),
    rowMax: Math.max(a.row, b.row),
    colMin: Math.min(a.col, b.col),
    colMax: Math.max(a.col, b.col),
  };
}

function inRect(row: number, col: number, r: Rect): boolean {
  return row >= r.rowMin && row <= r.rowMax && col >= r.colMin && col <= r.colMax;
}

const PLACEHOLDER_THUMB =
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=120&h=120&fit=crop&q=80";

function listingThumbUrl(listing: HostListingRecord): string {
  const u = listing.photos?.[0]?.trim();
  return u || PLACEHOLDER_THUMB;
}
function buildBulkPriceState(
  listingSlice: HostListingRecord[],
  isos: string[]
): Record<string, string> {
  if (isos.length === 0) return {};
  const next: Record<string, string> = {};
  const firstIso = isos[0];
  for (const listing of listingSlice) {
    const n = priceForNight(listing, firstIso);
    next[listing.id] = String(Math.round(n));
  }
  return next;
}

function ListingThumb({ listing }: { listing: HostListingRecord }) {
  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#ebebeb] shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={listingThumbUrl(listing)} alt="" className="h-full w-full object-cover" loading="lazy" />
      <span
        className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white shadow ${
          listing.published ? "bg-green-500" : "bg-[#bbb]"
        }`}
        title={listing.published ? "Publicado" : "Borrador"}
      />
    </div>
  );
}

export function HostCalendarView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [listings, setListings] = useState<HostListingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [selection, setSelection] = useState<Rect | null>(null);
  const dragRef = useRef<{ start: { row: number; col: number }; end: { row: number; col: number } } | null>(
    null
  );
  const [dragPreview, setDragPreview] = useState<Rect | null>(null);

  const [availabilityMode, setAvailabilityMode] = useState<"available" | "blocked">("blocked");
  const [bulkPriceByListing, setBulkPriceByListing] = useState<Record<string, string>>({});
  const [applyBusy, setApplyBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/host/listings", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudieron cargar los alojamientos.");
        return;
      }
      setListings(data.listings ?? []);
    } catch {
      setError("Error de red.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter((l) => l.title.toLowerCase().includes(q) || l.slug.toLowerCase().includes(q));
  }, [listings, filter]);

  useEffect(() => {
    setSelection(null);
    dragRef.current = null;
    setDragPreview(null);
  }, [filter]);

  const days = useMemo(() => daysInMonth(year, month), [year, month]);
  const todayISO = toLocalISODate(new Date());

  const selectionKey = useMemo(() => {
    if (!selection) return "";
    return [
      selection.rowMin,
      selection.rowMax,
      selection.colMin,
      selection.colMax,
      filter,
      year,
      month,
    ].join("|");
  }, [selection, filter, year, month]);

  useEffect(() => {
    if (!selection) {
      setBulkPriceByListing({});
      return;
    }
    const listingSlice = filtered.slice(selection.rowMin, selection.rowMax + 1);
    const isos = days.slice(selection.colMin, selection.colMax + 1).map(toLocalISODate);
    if (listingSlice.length === 0 || isos.length === 0) {
      setBulkPriceByListing({});
      return;
    }
    const resolved = listingSlice.map((l) => listings.find((x) => x.id === l.id) ?? l);
    setBulkPriceByListing(buildBulkPriceState(resolved, isos));
  }, [selectionKey, listings, filtered, days]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelection(null);
        dragRef.current = null;
        setDragPreview(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function goToday() {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
  }

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
    setSelection(null);
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
    setSelection(null);
  }

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1, y + 2];
  }, []);

  /** Alinea el radio de disponibilidad con lo que hay en el calendario al cambiar selección. */
  const availabilityFromSelection = useMemo(() => {
    if (!selection) return null;
    const listingSlice = filtered.slice(selection.rowMin, selection.rowMax + 1);
    const isos = days.slice(selection.colMin, selection.colMax + 1).map(toLocalISODate);
    if (listingSlice.length === 0 || isos.length === 0) return null;
    const resolved = listingSlice.map((l) => listings.find((x) => x.id === l.id) ?? l);
    const allBlocked = resolved.every((listing) =>
      isos.every((iso) => (listing.blockedDates ?? []).includes(iso))
    );
    return allBlocked ? ("blocked" as const) : ("available" as const);
  }, [selection, filtered, days, listings]);

  useEffect(() => {
    if (availabilityFromSelection) setAvailabilityMode(availabilityFromSelection);
  }, [availabilityFromSelection]);

  const selectionSummary = useMemo(() => {
    if (!selection) return null;
    const listingSlice = filtered.slice(selection.rowMin, selection.rowMax + 1);
    const isos = days.slice(selection.colMin, selection.colMax + 1).map(toLocalISODate);
    if (listingSlice.length === 0 || isos.length === 0) return null;
    const start = isos[0];
    const end = isos[isos.length - 1];
    const prices: number[] = [];
    for (const listing of listingSlice) {
      for (const iso of isos) {
        prices.push(priceForNight(listing, iso));
      }
    }
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    return {
      listings: listingSlice,
      listingIds: listingSlice.map((l) => l.id),
      isos,
      startLabel: start,
      endLabel: end,
      listingCount: listingSlice.length,
      dayCount: isos.length,
      minP,
      maxP,
      priceHint:
        minP === maxP ? formatMoney(minP) : `${formatMoney(minP)} – ${formatMoney(maxP)}`,
    };
  }, [selection, filtered, days]);

  async function applyBulk() {
    if (!selectionSummary) return;
    const { listingIds, isos, listings: listingSlice } = selectionSummary;

    setApplyBusy(true);
    try {
      const updatedRows: HostListingRecord[] = [];
      await Promise.all(
        listingIds.map(async (id) => {
          const listing = listings.find((l) => l.id === id);
          if (!listing) return;

          let blocked = [...(listing.blockedDates ?? [])];
          if (availabilityMode === "blocked") {
            for (const iso of isos) {
              if (!blocked.includes(iso)) blocked.push(iso);
            }
            blocked.sort();
          } else {
            blocked = blocked.filter((d) => !isos.includes(d));
          }

          const nightlyPriceOverrides = { ...(listing.nightlyPriceOverrides ?? {}) };
          const uniformRaw = bulkPriceByListing[id];
          const uniformNum =
            uniformRaw === undefined || String(uniformRaw).trim() === ""
              ? null
              : Number(String(uniformRaw).replace(/,/g, ""));
          if (uniformNum !== null && Number.isFinite(uniformNum) && uniformNum >= 0) {
            const rounded = Math.round(uniformNum * 100) / 100;
            for (const iso of isos) {
              nightlyPriceOverrides[iso] = rounded;
            }
          }

          const res = await fetch(`/api/host/listings/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              blockedDates: blocked,
              nightlyPriceOverrides,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Error");
          if (data.listing) {
            updatedRows.push(data.listing as HostListingRecord);
            setListings((prev) => prev.map((l) => (l.id === data.listing.id ? data.listing : l)));
          }
        })
      );

      const byId = new Map(updatedRows.map((l) => [l.id, l]));
      const freshSlice = listingSlice.map((l) => byId.get(l.id) ?? l);
      setBulkPriceByListing(buildBulkPriceState(freshSlice, isos));

      setToast("Cambios aplicados");
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error al guardar");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setApplyBusy(false);
    }
  }

  async function clearOverridesInSelection() {
    if (!selectionSummary) return;
    const { listingIds, isos } = selectionSummary;
    setApplyBusy(true);
    try {
      await Promise.all(
        listingIds.map(async (id) => {
          const listing = listings.find((l) => l.id === id);
          if (!listing) return;
          const nightlyPriceOverrides = { ...(listing.nightlyPriceOverrides ?? {}) };
          for (const iso of isos) {
            delete nightlyPriceOverrides[iso];
          }
          const res = await fetch(`/api/host/listings/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ nightlyPriceOverrides }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Error");
          if (data.listing) {
            setListings((prev) => prev.map((l) => (l.id === data.listing.id ? data.listing : l)));
          }
        })
      );
      setToast("Precios especiales quitados en la selección");
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Error");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setApplyBusy(false);
    }
  }

  function hitCalendarCell(ev: PointerEvent): { row: number; col: number } | null {
    const target = document.elementFromPoint(ev.clientX, ev.clientY);
    const el = target?.closest("[data-cal-cell]");
    if (!el) return null;
    const r = el.getAttribute("data-row");
    const c = el.getAttribute("data-col");
    if (r == null || c == null) return null;
    const row = Number(r);
    const col = Number(c);
    if (Number.isNaN(row) || Number.isNaN(col)) return null;
    return { row, col };
  }

  function handleCellPointerDown(row: number, col: number, e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const cell = { row, col };
    dragRef.current = { start: cell, end: cell };
    setDragPreview(normalizeRect(cell, cell));

    function onMove(ev: Event) {
      const pev = ev as PointerEvent;
      pev.preventDefault();
      const hit = hitCalendarCell(pev);
      if (!hit || !dragRef.current) return;
      dragRef.current = { ...dragRef.current, end: hit };
      setDragPreview(normalizeRect(dragRef.current.start, dragRef.current.end));
    }

    function endDrag() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      const d = dragRef.current;
      if (d) {
        setSelection(normalizeRect(d.start, d.end));
      }
      dragRef.current = null;
      setDragPreview(null);
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  }

  function cellHighlighted(row: number, col: number): boolean {
    const active = dragPreview ?? selection;
    if (!active) return false;
    return inRect(row, col, active);
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#484848]">Calendario</h1>
            <p className="mt-1 text-sm text-[#888]">
              Mantén pulsado y arrastra horizontal o verticalmente para elegir varios días (una fila o varias). El panel
              a la derecha aplica cambios a todo el bloque.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[#ebebeb] pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">Mes</label>
            <select
              className="rounded-lg border border-[#ddd] bg-white px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
              value={month}
              onChange={(e) => {
                setMonth(Number(e.target.value));
                setSelection(null);
              }}
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i}>
                  {name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-[#ddd] bg-white px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
                setSelection(null);
              }}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={goToday}
            className="rounded-full border border-[#ddd] bg-white px-4 py-2 text-sm font-semibold text-[#484848] transition hover:bg-[#f5f5f5]"
          >
            Hoy
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-lg border border-[#ddd] px-3 py-2 text-sm font-semibold text-[#484848] hover:bg-[#f5f5f5]"
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded-lg border border-[#ddd] px-3 py-2 text-sm font-semibold text-[#484848] hover:bg-[#f5f5f5]"
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-[#888]">Cargando calendario…</p>
        ) : listings.length === 0 ? (
          <div className="rounded-xl border border-[#ebebeb] bg-white p-10 text-center shadow-sm">
            <p className="text-sm text-[#888]">No tienes alojamientos aún.</p>
            <Link
              href="/host/listings/new"
              className="mt-4 inline-flex rounded-full px-5 py-2.5 text-sm font-semibold text-black shadow"
              style={{ backgroundColor: "#dcb81e" }}
            >
              Crear alojamiento
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#ebebeb] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-max min-w-full border-collapse text-sm" style={{ tableLayout: "fixed" }}>
                <thead>
                  <tr className="border-b border-[#ebebeb] bg-white">
                    <th
                      rowSpan={3}
                      className="sticky left-0 z-[25] w-[min(18rem,48vw)] min-w-[17rem] border-r border-[#ebebeb] bg-white px-3 py-3 text-left align-top shadow-[4px_0_12px_-4px_rgba(0,0,0,0.08)]"
                    >
                      <p className="text-xs font-bold uppercase tracking-wide text-[#aaa]">
                        {listings.length} alojamiento{listings.length === 1 ? "" : "s"}
                      </p>
                      <input
                        type="search"
                        placeholder="Buscar…"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-[#ddd] px-2 py-1.5 text-xs outline-none focus:border-[#dcb81e]"
                      />
                    <p className="mt-3 text-[10px] leading-snug text-[#aaa]">
                      Arrastra en el calendario para multiselección. Rayas = bloqueado. Esc = limpiar.
                    </p>
                    </th>
                    <th
                      colSpan={days.length}
                      className="border-b border-[#ebebeb] bg-[#fafafa] py-2 text-center text-sm font-semibold capitalize text-[#484848]"
                    >
                      {MONTH_NAMES[month]} {year}
                    </th>
                  </tr>
                  <tr className="border-b border-[#ebebeb] bg-[#fafafa]">
                    {days.map((d) => (
                      <th
                        key={`dow-${toLocalISODate(d)}`}
                        className="w-[52px] min-w-[52px] border-l border-[#f0f0f0] py-1.5 text-center text-[10px] font-medium text-[#888]"
                      >
                        {DOW_LETTER[d.getDay()]}
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b-2 border-[#ebebeb] bg-white">
                    {days.map((d) => {
                      const iso = toLocalISODate(d);
                      const isToday = iso === todayISO;
                      return (
                        <th
                          key={`num-${iso}`}
                          className={`w-[52px] min-w-[52px] border-l border-[#f0f0f0] py-2 text-center text-xs font-semibold ${
                            isToday ? "text-white" : "text-[#484848]"
                          }`}
                        >
                          <span
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                              isToday ? "bg-[#0d6868]" : ""
                            }`}
                          >
                            {d.getDate()}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((listing, row) => (
                    <tr key={listing.id} className="border-b border-[#ebebeb]">
                      <td className="sticky left-0 z-[15] max-w-[18rem] min-w-[17rem] border-r border-[#ebebeb] bg-white px-2 py-2 align-middle shadow-[4px_0_12px_-4px_rgba(0,0,0,0.06)]">
                        <div className="flex items-start gap-2.5">
                          <ListingThumb listing={listing} />
                          <div className="min-w-0 flex-1 py-0.5">
                            <Link
                              href={`/host/listings/${listing.id}/edit`}
                              className="line-clamp-2 font-medium leading-snug text-[#484848] underline decoration-[#ebebeb] decoration-1 underline-offset-2 hover:text-black hover:decoration-black"
                            >
                              {listing.title}
                            </Link>
                            <p className="mt-0.5 truncate text-[10px] text-[#aaa]">{listing.zone}</p>
                          </div>
                        </div>
                      </td>
                      {days.map((d, col) => {
                        const iso = toLocalISODate(d);
                        const blocked = (listing.blockedDates ?? []).includes(iso);
                        const isToday = iso === todayISO;
                        const price = priceForNight(listing, iso);
                        const hasOverride = listing.nightlyPriceOverrides?.[iso] !== undefined;
                        const hi = cellHighlighted(row, col);

                        return (
                          <td key={`${listing.id}-${iso}`} className="p-0 align-middle">
                            <div
                              role="button"
                              tabIndex={0}
                              data-cal-cell
                              data-row={row}
                              data-col={col}
                              onPointerDown={(e) => handleCellPointerDown(row, col, e)}
                              className={[
                                "relative flex h-14 w-[52px] min-w-[52px] touch-none flex-col items-center justify-center border-l border-[#f0f0f0] text-[11px] transition select-none",
                                blocked ? "text-[#777]" : "bg-white text-[#666]",
                                hi
                                  ? "z-[5] bg-[#ececec] font-bold text-black ring-2 ring-inset ring-black"
                                  : "",
                                !hi && isToday && !blocked ? "ring-1 ring-inset ring-[#0d6868]/25" : "",
                              ].join(" ")}
                              style={
                                blocked && !hi
                                  ? {
                                      backgroundImage: `repeating-linear-gradient(
                                        -45deg,
                                        #ececec,
                                        #ececec 4px,
                                        #f5f5f5 4px,
                                        #f5f5f5 8px
                                      )`,
                                    }
                                  : undefined
                              }
                            >
                              <span className="tabular-nums">{formatMoney(price)}</span>
                              {hasOverride && (
                                <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#dcb81e]" />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Panel lateral tipo Airbnb */}
      <aside className="w-full shrink-0 rounded-xl border border-[#ebebeb] bg-white p-5 shadow-sm lg:sticky lg:top-[88px] lg:max-h-[calc(100vh-100px)] lg:w-[min(28rem,100%)] lg:overflow-y-auto">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#aaa]">Editar selección</h2>
        {!selectionSummary ? (
          <p className="mt-3 text-sm leading-relaxed text-[#888]">
            Selecciona un bloque en la cuadrícula arrastrando el ratón (o el dedo). Podrás marcar fechas como{" "}
            <strong>disponibles</strong> o <strong>no disponibles</strong> y opcionalmente fijar un{" "}
            <strong>precio por noche</strong> para esas fechas.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-[#aaa]">Rango</p>
              <p className="mt-1 text-sm font-medium text-[#484848]">
                {selectionSummary.startLabel} → {selectionSummary.endLabel}
              </p>
              <p className="mt-1 text-xs text-[#888]">
                {selectionSummary.dayCount} día{selectionSummary.dayCount === 1 ? "" : "s"} ·{" "}
                {selectionSummary.listingCount} alojamiento
                {selectionSummary.listingCount === 1 ? "" : "s"}
              </p>
              <p className="mt-2 text-xs text-[#888]">
                Referencia en calendario:{" "}
                <span className="font-medium text-[#484848]">{selectionSummary.priceHint}</span>
                <span className="block text-[10px] text-[#aaa]">
                  Para cambiar el precio usa el campo de abajo y pulsa «Aplicar cambios».
                </span>
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">Disponibilidad</p>
              <div className="mt-2 space-y-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[#484848]">
                  <input
                    type="radio"
                    name="avail"
                    checked={availabilityMode === "available"}
                    onChange={() => setAvailabilityMode("available")}
                    className="accent-[#0d6868]"
                  />
                  Disponible (quitar bloqueo)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[#484848]">
                  <input
                    type="radio"
                    name="avail"
                    checked={availabilityMode === "blocked"}
                    onChange={() => setAvailabilityMode("blocked")}
                    className="accent-[#0d6868]"
                  />
                  No disponible (bloquear)
                </label>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">Precio por noche (MXN)</p>
              <p className="mt-1 text-[11px] leading-snug text-[#888]">
                Un solo importe por alojamiento: se aplicará a <strong>todas</strong> las fechas del rango (
                {selectionSummary.dayCount} día{selectionSummary.dayCount === 1 ? "" : "s"}). Base del anuncio si no
                cambias el valor.
              </p>
              <div className="mt-4 space-y-4">
                {selectionSummary.listings.map((listing) => (
                  <div key={listing.id} className="rounded-lg border border-[#ebebeb] bg-[#fafafa] p-3">
                    <div className="flex items-center gap-2 border-b border-[#ebebeb] pb-2">
                      <ListingThumb listing={listing} />
                      <p className="min-w-0 flex-1 text-xs font-semibold leading-tight text-[#484848]">{listing.title}</p>
                    </div>
                    <label className="mt-3 block text-[11px] font-medium text-[#666]" htmlFor={`bulk-p-${listing.id}`}>
                      Precio para todo el bloque seleccionado (MXN)
                    </label>
                    <input
                      key={`${selectionKey}-${listing.id}-price`}
                      id={`bulk-p-${listing.id}`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Ej. 920"
                      value={bulkPriceByListing[listing.id] ?? ""}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, "");
                        setBulkPriceByListing((prev) => ({
                          ...prev,
                          [listing.id]: cleaned,
                        }));
                      }}
                      className="mt-1 w-full rounded-lg border border-[#ddd] bg-white px-3 py-2 text-sm tabular-nums outline-none focus:border-[#dcb81e]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={applyBusy}
                onClick={applyBulk}
                className="rounded-full px-4 py-3 text-sm font-semibold text-black shadow transition hover:brightness-95 disabled:opacity-50"
                style={{ backgroundColor: "#dcb81e" }}
              >
                {applyBusy ? "Guardando…" : "Aplicar cambios"}
              </button>
              <button
                type="button"
                disabled={applyBusy}
                onClick={clearOverridesInSelection}
                className="rounded-full border border-[#ddd] px-4 py-2.5 text-sm font-semibold text-[#484848] transition hover:bg-[#fafafa] disabled:opacity-50"
              >
                Quitar precios especiales en selección
              </button>
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="text-center text-xs text-[#aaa] underline hover:text-[#484848]"
              >
                Limpiar selección
              </button>
            </div>
          </div>
        )}
      </aside>

      {toast && (
        <p
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#484848] px-4 py-2 text-sm text-white shadow-lg"
          role="status"
        >
          {toast}
        </p>
      )}
    </div>
  );
}
