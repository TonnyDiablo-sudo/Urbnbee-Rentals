"use client";

import { memo, useMemo } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { bookingPhaseOf, type BookingPhase } from "@/lib/booking-phase";
import { numberLocale, type Lang } from "@/lib/i18n";
import { Sheet } from "../../_components/sheet";
import { addDays, holdsNights, isConfirmed, isPending, stayOf, toIso, type HostBooking } from "../_shared/host-data";

type Kind = "in" | "out" | "stay";
type DayEvent = { kind: Kind; b: HostBooking };

/**
 * Reservas que cuentan en el calendario (ocupan noches o ya terminaron), del anuncio elegido o de
 * todos (`listingId` null), y si se pide, sólo las de una fase (por llegar, hospedados, terminadas…).
 */
export function scopedBookings(bookings: HostBooking[], listingId: string | null, phase: BookingPhase | null = null, today = ""): HostBooking[] {
  return bookings.filter(
    (b) =>
      (holdsNights(b.status) || b.status === "COMPLETED") &&
      (!listingId || stayOf(b).listingId === listingId) &&
      (!phase || bookingPhaseOf(b, today) === phase)
  );
}

function eventsOn(bookings: HostBooking[], iso: string): DayEvent[] {
  const out: DayEvent[] = [];
  for (const b of bookings) {
    const s = stayOf(b);
    if (s.checkIn === iso) out.push({ kind: "in", b });
    else if (s.checkOut === iso) out.push({ kind: "out", b });
    else if (s.checkIn < iso && iso < s.checkOut) out.push({ kind: "stay", b });
  }
  const order: Record<Kind, number> = { out: 0, in: 1, stay: 2 };
  return out.sort((a, b) => order[a.kind] - order[b.kind] || a.b.guestName.localeCompare(b.b.guestName));
}

function dayTitle(iso: string, today: string, lang: Lang, t: ReturnType<typeof useT>): string {
  const label = new Date(`${iso}T12:00:00`).toLocaleDateString(numberLocale(lang), { weekday: "long", day: "numeric", month: "long" });
  if (iso === today) return `${t("Hoy")} · ${label}`;
  if (iso === addDays(today, 1)) return `${t("Mañana")} · ${label}`;
  return label;
}

const KIND_LABEL: Record<Kind, string> = { in: "Llega", out: "Sale", stay: "Hospedado" };
const KIND_CLS: Record<Kind, string> = {
  in: "bg-[#e6f6ea] text-[#1e7a3a]",
  out: "bg-[#fdecea] text-[#b42318]",
  stay: "bg-[#f1f1f1] text-[#555]",
};

function EventRow({ e, showListing, onOpen }: { e: DayEvent; showListing: boolean; onOpen: (b: HostBooking) => void }) {
  const t = useT();
  const s = stayOf(e.b);
  const pending = isPending(e.b.status);
  return (
    <li>
      <button type="button" onClick={() => onOpen(e.b)} className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-[#f7f7f7]">
        <span className={`w-[84px] shrink-0 rounded-full px-2 py-1 text-center text-xs font-semibold ${KIND_CLS[e.kind]}`}>{t(KIND_LABEL[e.kind])}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-[#222]">{e.b.guestName}</span>
          <span className="block truncate text-[13px] text-[#717171]">
            {showListing ? `${s.title} · ` : ""}
            {e.b.nights === 1 ? t("1 noche") : t("{n} noches", { n: e.b.nights })}
          </span>
        </span>
        {pending ? (
          <span className="shrink-0 rounded-full bg-[#f3d45c] px-2 py-0.5 text-[11px] font-semibold text-black">{t("Por responder")}</span>
        ) : !isConfirmed(e.b.status) ? (
          <span className="shrink-0 rounded-full bg-[#eee] px-2 py-0.5 text-[11px] font-semibold text-[#555]">{t("Por pagar")}</span>
        ) : null}
      </button>
    </li>
  );
}

/**
 * Lista por días: llegadas y salidas de cada día dentro del rango (`to` null = sin tope);
 * hoy también quién sigue hospedado.
 */
export function BookingsDayList({
  bookings,
  today,
  range,
  showListing,
  onOpen,
}: {
  bookings: HostBooking[];
  today: string;
  range: { from: string; to: string | null };
  showListing: boolean;
  onOpen: (b: HostBooking) => void;
}) {
  const t = useT();
  const lang = useLang();
  const { from, to } = range;

  const days = useMemo(() => {
    const inRange = (iso: string) => iso >= from && (!to || iso <= to);
    const keys = new Set<string>();
    for (const b of bookings) {
      const s = stayOf(b);
      if (inRange(s.checkIn)) keys.add(s.checkIn);
      if (inRange(s.checkOut)) keys.add(s.checkOut);
      if (s.checkIn < today && today < s.checkOut && inRange(today)) keys.add(today);
    }
    return [...keys]
      .sort()
      .map((iso) => ({ iso, events: eventsOn(bookings, iso).filter((e) => e.kind !== "stay" || iso === today) }))
      .filter((d) => d.events.length > 0);
  }, [bookings, from, to, today]);

  return (
    <div className="pb-10">
      {days.length === 0 ? (
        <p className="mx-5 mt-4 rounded-2xl bg-[#f7f7f7] px-4 py-6 text-center text-sm text-[#717171]">
          {t("No hay llegadas ni salidas en este periodo.")}
        </p>
      ) : (
        days.map((d) => (
          <section key={d.iso} className="mt-4">
            <h2
              className={`sticky top-0 z-[5] border-y border-[#f0f0f0] px-5 py-2 text-sm font-semibold first-letter:uppercase ${
                d.iso === today ? "bg-[#fffbea] text-[#222]" : d.iso < today ? "bg-[#fafafa] text-[#999]" : "bg-white text-[#222]"
              }`}
            >
              {dayTitle(d.iso, today, lang, t)}
            </h2>
            <ul className="divide-y divide-[#f5f5f5]">
              {d.events.map((e) => (
                <EventRow key={`${e.kind}:${e.b.id}`} e={e} showListing={showListing} onOpen={onOpen} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

/** Mes con todos los anuncios: cuántos están ocupados cada noche y cuántas llegadas hay. */
export const AllListingsMonth = memo(function AllListingsMonth({
  month,
  today,
  bookings,
  total,
  onTap,
}: {
  month: Date;
  today: string;
  bookings: HostBooking[];
  total: number;
  onTap: (iso: string) => void;
}) {
  const lang = useLang();
  const first = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(toIso(new Date(month.getFullYear(), month.getMonth(), d)));

  return (
    <section className="px-3 pt-5">
      <h2 className="mb-2 px-2 text-lg font-semibold text-[#222] first-letter:uppercase">
        {month.toLocaleDateString(numberLocale(lang), { month: "long", year: "numeric" })}
      </h2>
      <div className="grid grid-cols-7 gap-px">
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} />;
          let occ = 0;
          let confirmed = 0;
          let arrivals = 0;
          for (const b of bookings) {
            const s = stayOf(b);
            if (s.checkIn <= iso && iso < s.checkOut) {
              occ++;
              if (isConfirmed(b.status)) confirmed++;
            }
            if (s.checkIn === iso) arrivals++;
          }
          const past = iso < today;
          let cls = "bg-white text-[#222]";
          if (occ > 0) cls = confirmed > 0 ? (occ >= total ? "bg-[#111] text-white" : "bg-[#555] text-white") : "bg-[#f3d45c] text-black";
          if (past) cls += " opacity-50";
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onTap(iso)}
              aria-label={`${iso} · ${occ}/${total}`}
              className={`relative flex h-[68px] touch-manipulation select-none flex-col justify-between overflow-hidden rounded-md p-1.5 text-left active:opacity-80 ${cls}`}
            >
              <span className={`text-[13px] font-semibold leading-none ${iso === today ? "underline decoration-2 underline-offset-2" : ""}`}>
                {Number(iso.slice(8))}
              </span>
              {arrivals > 0 && (
                <span className="absolute right-1 top-1 rounded-full bg-[#1e7a3a] px-1.5 text-[10px] font-bold leading-4 text-white">+{arrivals}</span>
              )}
              {occ > 0 && <span className="text-[11px] font-semibold leading-tight">{`${occ}/${total}`}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
});

/** Lo que pasa en un día, en todos los anuncios. */
export function DaySheet({
  iso,
  today,
  bookings,
  onClose,
  onOpen,
}: {
  iso: string | null;
  today: string;
  bookings: HostBooking[];
  onClose: () => void;
  onOpen: (b: HostBooking) => void;
}) {
  const t = useT();
  const lang = useLang();
  const events = iso ? eventsOn(bookings, iso) : [];
  return (
    <Sheet open={Boolean(iso)} onClose={onClose} title={iso ? dayTitle(iso, today, lang, t) : ""}>
      {events.length === 0 ? (
        <p className="text-sm text-[#717171]">{t("Ese día no hay reservas.")}</p>
      ) : (
        <ul className="-mx-5 divide-y divide-[#f5f5f5]">
          {events.map((e) => (
            <EventRow key={`${e.kind}:${e.b.id}`} e={e} showListing onOpen={onOpen} />
          ))}
        </ul>
      )}
    </Sheet>
  );
}
