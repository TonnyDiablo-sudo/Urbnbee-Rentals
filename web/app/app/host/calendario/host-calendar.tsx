"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale } from "@/lib/i18n";
import { nightPrice, type ListingPricing } from "@/lib/listing-pricing";
import { sizedImage } from "@/lib/image-url";
import { Sheet } from "../../_components/sheet";
import {
  addDays,
  holdsNights,
  isConfirmed,
  isPending,
  patchListing,
  stayOf,
  toIso,
  todayIso,
  useHostBookings,
  useHostListings,
  type HostBooking,
  type HostListing,
} from "../_shared/host-data";
import { ReservationSheet } from "../_shared/reservation-sheet";

const MONTHS_AHEAD = 12;
const FIRST_PAINT_MONTHS = 2;
const inputCls = "mt-1 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-base outline-none focus:border-[#222]";
const NO_NIGHTS: ReadonlySet<string> = new Set();
const NO_BOOKINGS: HostBooking[] = [];

function shortMoney(n: number): string {
  return `$${Math.round(n).toLocaleString("es-MX")}`;
}

function eachNight(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function HostCalendar() {
  const t = useT();
  const lang = useLang();
  const params = useSearchParams();
  const listings = useHostListings();
  const bookings = useHostBookings() ?? NO_BOOKINGS;
  const [sel, setSel] = useState<ReadonlySet<string>>(NO_NIGHTS);
  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openBooking, setOpenBooking] = useState<HostBooking | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [monthsShown, setMonthsShown] = useState(FIRST_PAINT_MONTHS);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => window.setTimeout(() => setMonthsShown(MONTHS_AHEAD), 0));
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const [wanted, setWanted] = useState(() => params.get("anuncio"));
  const [picked, setPicked] = useState(wanted);
  const [switching, startSwitch] = useTransition();
  const listing = listings?.find((l) => l.id === wanted) ?? listings?.[0] ?? null;
  const pickedId = picked ?? listing?.id;

  const choose = (id: string) => {
    window.history.replaceState(null, "", `/host/calendario?anuncio=${encodeURIComponent(id)}`);
    setPicked(id);
    startSwitch(() => {
      setSel(NO_NIGHTS);
      setWanted(id);
    });
  };

  /** Noche → reserva que la ocupa, para este anuncio. */
  const nightToBooking = useMemo(() => {
    const map = new Map<string, HostBooking>();
    if (!listing) return map;
    for (const b of bookings) {
      if (!holdsNights(b.status)) continue;
      const s = stayOf(b);
      if (s.listingId !== listing.id) continue;
      for (let d = s.checkIn; d < s.checkOut; d = addDays(d, 1)) map.set(d, b);
    }
    return map;
  }, [bookings, listing]);

  const today = todayIso();
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: MONTHS_AHEAD }, (_, i) => new Date(now.getFullYear(), now.getMonth() + i, 1));
  }, []);

  /**
   * Como Airbnb: con una noche elegida, tocar otra marca todo el rango; tocar una elegida la quita;
   * con varias elegidas, tocar otra la suma.
   */
  const tapDay = useCallback(
    (iso: string) => {
      const b = nightToBooking.get(iso);
      if (b) {
        setOpenBooking(b);
        return;
      }
      if (iso < today) return;
      setSel((prev) => {
        const next = new Set(prev);
        if (next.has(iso)) {
          next.delete(iso);
          return next;
        }
        if (prev.size === 1) {
          const [anchor] = prev;
          const [from, to] = anchor < iso ? [anchor, iso] : [iso, anchor];
          for (const d of eachNight(from, to)) if (!nightToBooking.has(d)) next.add(d);
          return next;
        }
        next.add(iso);
        return next;
      });
    },
    [today, nightToBooking]
  );

  if (listings === null) return <p className="px-5 py-6 text-sm text-[#999]">{t("Cargando…")}</p>;

  if (!listing) {
    return (
      <div className="px-5 py-8">
        <p className="text-base font-semibold text-[#222]">{t("Todavía no tienes anuncios")}</p>
        <p className="mt-1 text-sm text-[#717171]">{t("Crea un anuncio para ver y administrar su calendario.")}</p>
        <Link href="/host/anuncios/nuevo" className="mt-5 inline-block rounded-xl bg-[#dcb81e] px-5 py-3 text-sm font-semibold text-black">
          {t("Crear anuncio")}
        </Link>
      </div>
    );
  }

  const selected = [...sel].sort();
  const monthKey = (m: Date) => toIso(m).slice(0, 7);

  return (
    <div className="pb-40">
      <div className="flex gap-2.5 overflow-x-auto px-5 pb-3 [scrollbar-width:none]">
        {listings.map((l) => {
          const on = l.id === pickedId;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => choose(l.id)}
              className={`flex w-40 shrink-0 items-center gap-2 rounded-2xl border p-1.5 pr-3 text-left ${on ? "border-[#222] ring-1 ring-[#222]" : "border-[#e5e5e5]"}`}
            >
              <span className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-[#eee]">
                {l.photos[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sizedImage(l.photos[0], 120)} alt="" className="h-full w-full object-cover" />
                )}
              </span>
              <span className="line-clamp-2 text-xs font-medium leading-tight text-[#222]">{l.title}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-y border-[#f0f0f0] px-5 py-2.5">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#717171]">
          <Legend cls="bg-[#111]" label={t("Reservada")} />
          <Legend cls="bg-[#f3d45c]" label={t("Por responder")} />
          <Legend cls="bg-[#e9e9e9] bg-[repeating-linear-gradient(135deg,transparent_0_4px,#cfcfcf_4px_5px)]" label={t("Bloqueada")} />
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="shrink-0 rounded-full border border-[#222] px-3.5 py-1.5 text-sm font-semibold text-[#222]"
        >
          {t("Precios")}
        </button>
      </div>

      <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-[#f0f0f0] bg-white px-3 py-2 text-center text-[11px] font-medium text-[#999]">
        {["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"].map((d) => (
          <span key={d}>{t(d)}</span>
        ))}
      </div>

      <div className={`transition-opacity ${switching ? "opacity-50" : ""}`}>
        {months.slice(0, monthsShown).map((m) => {
          const mk = monthKey(m);
          return (
            <MonthGrid
              key={mk}
              month={m}
              lang={lang}
              today={today}
              listing={listing}
              nightToBooking={nightToBooking}
              selKey={selected.filter((d) => d.startsWith(mk)).join(",")}
              onTap={tapDay}
            />
          );
        })}
      </div>

      {sel.size > 0 && (
        <div
          className="fixed inset-x-0 z-40 border-t border-[#ebebeb] bg-white"
          style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-xl items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[#222]">
                {selected.length === 1 ? t("1 noche seleccionada") : t("{n} noches seleccionadas", { n: selected.length })}
              </p>
              <button type="button" onClick={() => setSel(NO_NIGHTS)} className="text-sm text-[#717171] underline">
                {t("Quitar selección")}
              </button>
            </div>
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={() => setEditOpen(true)}
              className="rounded-xl bg-[#dcb81e] px-5 py-3 text-[15px] font-semibold text-black disabled:opacity-40"
            >
              {t("Editar")}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <p className="fixed inset-x-0 top-4 z-[110] mx-auto w-fit rounded-full bg-[#111] px-4 py-2 text-sm font-medium text-white shadow-lg">
          {t(toast)}
        </p>
      )}

      <NightsEditor
        key={`${listing.id}:${editOpen}`}
        open={editOpen}
        listing={listing}
        nights={selected}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          setSel(NO_NIGHTS);
          setToast("Calendario actualizado.");
        }}
      />

      <PriceSettings
        key={`${listing.id}:${settingsOpen}`}
        open={settingsOpen}
        listing={listing}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => {
          setSettingsOpen(false);
          setToast("Precios guardados.");
        }}
      />

      <ReservationSheet booking={openBooking} onClose={() => setOpenBooking(null)} />
    </div>
  );
}

/** Un mes del calendario; sólo se vuelve a pintar si cambia algo de ese mes. */
const MonthGrid = memo(function MonthGrid({
  month,
  lang,
  today,
  listing,
  nightToBooking,
  selKey,
  onTap,
}: {
  month: Date;
  lang: ReturnType<typeof useLang>;
  today: string;
  listing: HostListing;
  nightToBooking: Map<string, HostBooking>;
  selKey: string;
  onTap: (iso: string) => void;
}) {
  const t = useT();
  const selSet = new Set(selKey ? selKey.split(",") : []);
  const blocked = new Set(listing.blockedDates);
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
          const b = nightToBooking.get(iso);
          const past = iso < today;
          const isBlocked = blocked.has(iso);
          const isSel = selSet.has(iso);
          const price = nightPrice(listing, iso);
          const custom = listing.nightlyPriceOverrides?.[iso] !== undefined;
          const day = Number(iso.slice(8));
          const bStart = b ? stayOf(b).checkIn === iso : false;
          const showName = b && (bStart || new Date(`${iso}T12:00:00`).getDay() === 0);

          let cls = "bg-white text-[#222] active:bg-[#f3f3f3]";
          if (b) cls = isConfirmed(b.status) ? "bg-[#111] text-white" : isPending(b.status) ? "bg-[#f3d45c] text-black" : "bg-[#e5e5e5] text-[#555]";
          else if (isSel) cls = "bg-[#222] text-white ring-2 ring-inset ring-[#dcb81e]";
          else if (isBlocked) cls = "bg-[#f1f1f1] text-[#aaa] bg-[repeating-linear-gradient(135deg,transparent_0_6px,#e0e0e0_6px_7px)]";
          if (past && !b) cls = "bg-white text-[#cfcfcf]";

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onTap(iso)}
              disabled={past && !b}
              aria-pressed={isSel}
              aria-label={`${iso}${b ? ` · ${b.guestName}` : isBlocked ? ` · ${t("Bloqueada")}` : ` · ${shortMoney(price)}`}`}
              className={`relative flex h-[68px] touch-manipulation select-none flex-col justify-between overflow-hidden rounded-md p-1.5 text-left [-webkit-tap-highlight-color:transparent] ${cls}`}
            >
              <span className={`text-[13px] font-semibold leading-none ${iso === today ? "underline decoration-2 underline-offset-2" : ""} ${isBlocked && !b ? "line-through" : ""}`}>
                {day}
              </span>
              {b ? (
                showName && <span className="truncate text-[10px] font-semibold leading-tight">{b.guestName.split(" ")[0]}</span>
              ) : (
                !past &&
                !isBlocked && (
                  <span className={`truncate text-[10px] leading-tight ${custom && !isSel ? "font-semibold text-[#8a6d0f]" : ""}`}>
                    {shortMoney(price)}
                  </span>
                )
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
});

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-sm ${cls}`} />
      {label}
    </span>
  );
}

/** Abrir/bloquear y precio por noche para las noches elegidas. */
function NightsEditor({
  open,
  listing,
  nights,
  onClose,
  onSaved,
}: {
  open: boolean;
  listing: HostListing;
  nights: string[];
  onClose: () => void;
  onSaved: (l: HostListing) => void;
}) {
  const t = useT();
  const allBlocked = nights.length > 0 && nights.every((d) => listing.blockedDates.includes(d));
  const prices = [...new Set(nights.map((d) => nightPrice(listing, d)))];
  const [available, setAvailable] = useState(!allBlocked);
  const [price, setPrice] = useState(prices.length === 1 ? String(prices[0]) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const hasCustom = nights.some((d) => listing.nightlyPriceOverrides?.[d] !== undefined);

  const save = async (resetPrice = false) => {
    const set = new Set(listing.blockedDates);
    for (const d of nights) {
      if (available) set.delete(d);
      else set.add(d);
    }
    const overrides = { ...(listing.nightlyPriceOverrides ?? {}) };
    const n = Number(price);
    if (resetPrice) {
      for (const d of nights) delete overrides[d];
    } else if (price.trim() !== "" && prices.join() !== String(n)) {
      if (!Number.isFinite(n) || n <= 0) {
        setErr("Escribe un precio mayor a cero.");
        return;
      }
      for (const d of nights) {
        const base = nightPrice({ ...listing, nightlyPriceOverrides: {} }, d);
        if (Math.round(n) === base) delete overrides[d];
        else overrides[d] = Math.round(n);
      }
    }
    setBusy(true);
    setErr(null);
    const r = await patchListing(listing.id, {
      blockedDates: [...set].sort(),
      nightlyPriceOverrides: overrides,
    });
    setBusy(false);
    if (r.listing) onSaved(r.listing);
    else setErr(r.error ?? "No se pudo guardar.");
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={nights.length === 1 ? t("1 noche seleccionada") : t("{n} noches seleccionadas", { n: nights.length })}
    >
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-semibold text-[#222]">{t("Disponibilidad")}</p>
          <div className="grid grid-cols-2 rounded-xl bg-[#f1f1f1] p-1">
            {[
              { v: true, label: "Disponible" },
              { v: false, label: "Bloqueada" },
            ].map((o) => (
              <button
                key={String(o.v)}
                type="button"
                onClick={() => setAvailable(o.v)}
                className={`rounded-lg py-2.5 text-[15px] font-semibold ${available === o.v ? "bg-white text-[#222] shadow" : "text-[#717171]"}`}
              >
                {t(o.label)}
              </button>
            ))}
          </div>
        </div>

        <label className="block text-sm font-semibold text-[#222]">
          {t("Precio por noche (MXN)")}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={price}
            placeholder={prices.length > 1 ? t("Varios precios") : ""}
            onChange={(e) => setPrice(e.target.value)}
            className={inputCls}
          />
          <span className="mt-1 block text-xs font-normal text-[#717171]">
            {t("Precio base: {price}", { price: shortMoney(listing.pricePerNight) })}
            {listing.pricing?.weekendPrice ? ` · ${t("Viernes y sábado: {price}", { price: shortMoney(listing.pricing.weekendPrice) })}` : ""}
          </span>
        </label>

        {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(err)}</p>}

        <div className="space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="w-full rounded-xl bg-[#dcb81e] py-3.5 text-[15px] font-semibold text-black disabled:opacity-50"
          >
            {busy ? t("Guardando…") : t("Guardar")}
          </button>
          {hasCustom && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(true)}
              className="w-full py-2 text-sm font-medium text-[#222] underline disabled:opacity-50"
            >
              {t("Volver al precio base en estas noches")}
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/** Precio base, fin de semana, descuentos y duración de la estancia. */
export function PriceSettings({
  open,
  listing,
  onClose,
  onSaved,
}: {
  open: boolean;
  listing: HostListing;
  onClose: () => void;
  onSaved: (l: HostListing) => void;
}) {
  const t = useT();
  const p: ListingPricing = listing.pricing ?? {};
  const [f, setF] = useState({
    base: String(listing.pricePerNight || ""),
    weekend: p.weekendPrice ? String(p.weekendPrice) : "",
    cleaning: String(listing.cleaningFee || ""),
    weekly: p.weeklyDiscountPct ? String(p.weeklyDiscountPct) : "",
    monthly: p.monthlyDiscountPct ? String(p.monthlyDiscountPct) : "",
    minNights: p.minNights ? String(p.minNights) : "",
    maxNights: p.maxNights ? String(p.maxNights) : "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const save = async () => {
    const base = Number(f.base);
    if (!Number.isFinite(base) || base <= 0) {
      setErr("Escribe un precio base mayor a cero.");
      return;
    }
    setBusy(true);
    setErr(null);
    const r = await patchListing(listing.id, {
      pricePerNight: Math.round(base),
      cleaningFee: Math.max(0, Math.round(Number(f.cleaning) || 0)),
      pricing: {
        weekendPrice: f.weekend,
        weeklyDiscountPct: f.weekly,
        monthlyDiscountPct: f.monthly,
        minNights: f.minNights,
        maxNights: f.maxNights,
      },
    });
    setBusy(false);
    if (r.listing) onSaved(r.listing);
    else setErr(r.error ?? "No se pudo guardar.");
  };

  const field = (k: keyof typeof f, label: string, hint?: string, suffix?: string) => (
    <label className="block text-sm font-semibold text-[#222]">
      {t(label)}
      <div className="relative">
        <input type="number" inputMode="numeric" min={0} value={f[k]} onChange={set(k)} className={inputCls} />
        {suffix && <span className="pointer-events-none absolute right-4 top-1/2 mt-0.5 -translate-y-1/2 text-[#717171]">{suffix}</span>}
      </div>
      {hint && <span className="mt-1 block text-xs font-normal text-[#717171]">{t(hint)}</span>}
    </label>
  );

  return (
    <Sheet open={open} onClose={onClose} title={t("Precios y estancia")}>
      <div className="space-y-5">
        <p className="text-sm text-[#717171]">{listing.title}</p>
        <h3 className="text-base font-semibold text-[#222]">{t("Precio por noche")}</h3>
        {field("base", "Precio base (MXN)", "Aplica a todas las noches que no tengan otro precio.")}
        {field("weekend", "Precio de viernes y sábado (MXN)", "Déjalo vacío para usar el precio base.")}
        {field("cleaning", "Limpieza (MXN)", "Se cobra una vez por reserva.")}

        <h3 className="pt-2 text-base font-semibold text-[#222]">{t("Descuentos")}</h3>
        {field("weekly", "Descuento semanal", "Para estancias de 7 noches o más.", "%")}
        {field("monthly", "Descuento mensual", "Para estancias de 28 noches o más.", "%")}

        <h3 className="pt-2 text-base font-semibold text-[#222]">{t("Duración de la estancia")}</h3>
        <div className="grid grid-cols-2 gap-3">
          {field("minNights", "Mínimo de noches")}
          {field("maxNights", "Máximo de noches")}
        </div>

        {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(err)}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="w-full rounded-xl bg-[#dcb81e] py-3.5 text-[15px] font-semibold text-black disabled:opacity-50"
        >
          {busy ? t("Guardando…") : t("Guardar")}
        </button>
        <p className="text-xs text-[#999]">{t("Los cambios aplican a reservas nuevas; las que ya existen conservan su precio.")}</p>
      </div>
    </Sheet>
  );
}
