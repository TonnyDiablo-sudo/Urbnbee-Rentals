"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale } from "@/lib/i18n";

export type SearchableBooking = {
  id: string;
  token?: string;
  status: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  party?: { name: string }[];
  checkIn: string;
  checkOut: string;
  hostAdjustedCheckIn?: string;
  hostAdjustedCheckOut?: string;
  nights: number;
  listingTitle: string;
  effectiveListingTitle?: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  AWAITING_PAYMENT: { label: "Esperando pago", cls: "bg-[#eee] text-[#555]" },
  PENDING: { label: "Pendiente", cls: "bg-[#f3d45c] text-black" },
  PENDING_HOST: { label: "Por aceptar", cls: "bg-[#f3d45c] text-black" },
  AWAITING_DETAILS: { label: "Esperando datos", cls: "bg-[#e6f6ea] text-[#1e7a3a]" },
  CONFIRMED: { label: "Confirmada", cls: "bg-[#e6f6ea] text-[#1e7a3a]" },
  REJECTED: { label: "Rechazada", cls: "bg-[#fdecea] text-[#b42318]" },
  CANCELLED: { label: "Cancelada", cls: "bg-[#fdecea] text-[#b42318]" },
  COMPLETED: { label: "Terminada", cls: "bg-[#f1f1f1] text-[#555]" },
  EXPIRED: { label: "Vencida", cls: "bg-[#f1f1f1] text-[#555]" },
};

const MAX_RESULTS = 25;

function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** «octubre 2026 october oct 2026-10» para que se pueda buscar por mes o por año. */
function dateWords(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const words = new Set<string>([iso.slice(0, 4), iso.slice(0, 7)]);
  for (const loc of ["es-MX", "en-US"]) {
    words.add(d.toLocaleDateString(loc, { month: "long" }));
    words.add(d.toLocaleDateString(loc, { month: "short" }).replace(/\.$/, ""));
  }
  return [...words].join(" ");
}

function haystack(b: SearchableBooking): string {
  return norm(
    [
      b.guestName,
      b.guestEmail,
      b.guestPhone?.replace(/\D/g, ""),
      b.id,
      b.token,
      b.listingTitle,
      b.effectiveListingTitle,
      ...(b.party ?? []).map((p) => p.name),
      dateWords(b.hostAdjustedCheckIn ?? b.checkIn),
      dateWords(b.hostAdjustedCheckOut ?? b.checkOut),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

/** Busca por nombre, correo, teléfono, acompañantes, anuncio, código de reserva, mes o año de la estancia. */
export function BookingSearch<B extends SearchableBooking>({
  bookings,
  onOpen,
  hrefFor,
  className = "",
}: {
  bookings: B[];
  onOpen?: (b: B) => void;
  hrefFor?: (b: B) => string;
  className?: string;
}) {
  const t = useT();
  const lang = useLang();
  const [q, setQ] = useState("");
  const index = useMemo(() => bookings.map((b) => ({ b, text: haystack(b) })), [bookings]);

  const results = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const today = new Date().toISOString().slice(0, 10);
    const distance = (b: SearchableBooking) => {
      const ci = b.hostAdjustedCheckIn ?? b.checkIn;
      const co = b.hostAdjustedCheckOut ?? b.checkOut;
      if (ci <= today && today < co) return 0;
      return Math.abs(new Date(ci).getTime() - new Date(today).getTime());
    };
    return index
      .filter(({ text }) => words.every((w) => text.includes(w.replace(/^\+?(\d)/, "$1"))))
      .map(({ b }) => b)
      .sort((a, b) => distance(a) - distance(b))
      .slice(0, MAX_RESULTS);
  }, [index, q]);

  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(numberLocale(lang), { day: "numeric", month: "short", year: "numeric" }).replace(/\.$/, "");

  return (
    <div className={`relative ${className}`}>
      <label className="flex items-center gap-2 rounded-full border border-[#ddd] bg-white px-4 py-2.5 focus-within:border-[#222]">
        <span aria-hidden className="text-[#999]">
          🔍
        </span>
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("Buscar reserva: huésped, anuncio, código, mes o año")}
          aria-label={t("Buscar reserva")}
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#999]"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="text-sm font-medium text-[#717171]" aria-label={t("Borrar búsqueda")}>
            ✕
          </button>
        )}
      </label>
      {q.trim() && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-sm">
          {results.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-[#717171]">{t("No encontramos reservas con esa búsqueda.")}</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-[#f2f2f2] overflow-y-auto">
              {results.map((b) => {
                const st = STATUS[b.status] ?? { label: b.status, cls: "bg-[#eee] text-[#555]" };
                const row = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-[#222]">{b.guestName}</span>
                      <span className="block truncate text-[13px] text-[#717171]">{b.effectiveListingTitle ?? b.listingTitle}</span>
                      <span className="block text-[13px] text-[#717171]">
                        {fmt(b.hostAdjustedCheckIn ?? b.checkIn)} – {fmt(b.hostAdjustedCheckOut ?? b.checkOut)} ·{" "}
                        {b.nights === 1 ? t("1 noche") : t("{n} noches", { n: b.nights })}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{t(st.label)}</span>
                  </>
                );
                const cls = "flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#fafafa] active:bg-[#f5f5f5]";
                return (
                  <li key={b.id}>
                    {hrefFor ? (
                      <Link href={hrefFor(b)} className={cls}>
                        {row}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={cls}
                        onClick={() => {
                          setQ("");
                          onOpen?.(b);
                        }}
                      >
                        {row}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Para la web: carga las reservas del anfitrión y enlaza a su detalle. */
export function HostBookingSearch({ className }: { className?: string }) {
  const [bookings, setBookings] = useState<SearchableBooking[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/host/bookings", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && Array.isArray(j?.bookings)) setBookings(j.bookings);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return <BookingSearch bookings={bookings} hrefFor={(b) => `/host/reservas/${encodeURIComponent(b.id)}`} className={className} />;
}
