"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import {
  fullMonthsBetween,
  quoteStay,
  stayLengthError,
  type ListingPricing,
  type StayDiscountKind,
} from "@/lib/listing-pricing";
import { computeStayTax, type HostTaxSettings } from "@/lib/stay-tax";
import {
  BOOKING_EMAIL_ERROR,
  BOOKING_PHONE_ERROR,
  normalizeBookingEmail,
  normalizeBookingPhone,
} from "@/lib/booking-contact";

const DISCOUNT_LABEL: Record<StayDiscountKind, string> = {
  long_stay: "Descuento por estancia de {months} meses o más ({n}%)",
  monthly: "Descuento mensual ({n}%)",
  weekly: "Descuento semanal ({n}%)",
  early_bird: "Reserva anticipada ({n}%)",
  last_minute: "Descuento de última hora ({n}%)",
};

const DAYS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isInRange(d: Date, start: Date | null, end: Date | null) {
  if (!start || !end) return false;
  return d > start && d < end;
}
function parseIsoLocal(iso?: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isBlocked(d: Date, blocked: string[]) {
  return blocked.includes(localISO(d));
}

type CalendarMonthProps = {
  year: number;
  month: number;
  checkin: Date | null;
  checkout: Date | null;
  hover: Date | null;
  blocked: string[];
  today: Date;
  onSelect: (d: Date) => void;
  onHover: (d: Date | null) => void;
};

function CalendarMonth({ year, month, checkin, checkout, hover, blocked, today, onSelect, onHover }: CalendarMonthProps) {
  const t = useT();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = Array(first).fill(null);
  for (let i = 1; i <= days; i++) cells.push(new Date(year, month, i));

  const effectiveEnd = checkout ?? hover;

  return (
    <div className="min-w-0">
      <div className="mb-3 text-center text-sm font-semibold text-[#484848]">
        {t(MONTHS[month])} {year}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {DAYS.map((d) => (
          <div key={d} className="py-1 text-xs font-medium text-[#aaa]">{t(d)}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const past = d < today && !isSameDay(d, today);
          const blocked_ = isBlocked(d, blocked);
          const disabled = past || blocked_;
          const isStart = checkin && isSameDay(d, checkin);
          const isEnd = checkout && isSameDay(d, checkout);
          const inRange = isInRange(d, checkin, effectiveEnd);
          const isHovered = hover && isSameDay(d, hover) && checkin && !checkout;

          let bg = "transparent";
          let color = "#484848";
          const cursor = disabled ? "default" : "pointer";

          if (disabled) { color = "#ccc"; }
          else if (isStart || isEnd) { bg = "#dcb81e"; color = "#000"; }
          else if (inRange) { bg = "#c5e3e7"; }
          else if (isHovered) { bg = "#f5f5f5"; }

          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onSelect(d)}
              onMouseEnter={() => !disabled && onHover(d)}
              onMouseLeave={() => onHover(null)}
              className="rounded py-1.5 text-xs transition"
              style={{ backgroundColor: bg, color, cursor, fontWeight: isStart || isEnd ? 700 : 400 }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Props = {
  pricePerNight: number;
  cleaningFee?: number;
  blockedDates: string[];
  nightlyPriceOverrides?: Record<string, number>;
  pricing?: ListingPricing;
  depositMxn?: number;
  tax?: HostTaxSettings;
  /** false: el anfitrión aprueba cada solicitud y confirma el total final. */
  instantBook?: boolean;
  /** Si se pasa, el flujo exige usuario registrado y pago antes de confirmar. */
  listingId?: string;
  /** Si es false, el anuncio queda en directorio: chat/contacto, sin «Reserva con cuenta». */
  bookable?: boolean;
  /** Para cancel_url de Stripe y enlaces de login */
  listingSlug?: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  bookingRef?: string;
  /** Rutas propias de la app instalada; sin esto se usan las del sitio web. */
  appRoutes?: {
    login: string;
    register: string;
    membership: string;
    cancelPath: string;
    successPath: string;
  };
};

export function AvailabilityCalendar({
  pricePerNight,
  cleaningFee = 0,
  blockedDates,
  nightlyPriceOverrides,
  pricing,
  depositMxn = 0,
  tax,
  instantBook = true,
  listingId,
  bookable = true,
  listingSlug = "",
  initialCheckIn,
  initialCheckOut,
  bookingRef,
  appRoutes,
}: Props) {
  const t = useT();
  const today = new Date(); today.setHours(0,0,0,0);
  const seedIn = parseIsoLocal(initialCheckIn);
  const seedOut = parseIsoLocal(initialCheckOut);
  const [baseMonth, setBaseMonth] = useState((seedIn ?? today).getMonth());
  const [baseYear, setBaseYear] = useState((seedIn ?? today).getFullYear());
  const [checkin, setCheckin] = useState<Date | null>(seedIn);
  const [checkout, setCheckout] = useState<Date | null>(seedOut && seedIn && seedOut > seedIn ? seedOut : null);
  const [hover, setHover] = useState<Date | null>(null);
  const [sessionUser, setSessionUser] = useState<{
    fullName: string;
    email: string;
  } | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingErr, setBookingErr] = useState<string | null>(null);
  const [needsVerificationGate, setNeedsVerificationGate] = useState(false);
  const [reserveDone, setReserveDone] = useState<{
    token: string;
    bookingId: string;
    needsDemoPayment: boolean;
  } | null>(null);

  const reservePath = appRoutes?.cancelPath ?? (listingSlug ? `/listings/${listingSlug}` : "/");
  const loginHref = appRoutes?.login ?? `/login?next=${encodeURIComponent(reservePath)}`;
  const registerHref = appRoutes?.register ?? `/register?next=${encodeURIComponent(reservePath)}`;
  const membershipHref = appRoutes?.membership ?? "/guest/membresia";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data.user) {
          setSessionUser({
            fullName: data.user.fullName ?? "",
            email: data.user.email ?? "",
          });
          setContactEmail((v) => v || (data.user.emailIsPlaceholder ? "" : (data.user.email ?? "")));
          setContactPhone((v) => v || (typeof data.user.phone === "string" ? data.user.phone : ""));
        } else if (!cancelled) {
          setSessionUser(null);
        }
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!listingId) return;
    setBookingErr(null);
    setNeedsVerificationGate(false);
    setReserveDone(null);
  }, [listingId, checkin, checkout]);

  const month2 = baseMonth === 11 ? 0 : baseMonth + 1;
  const year2 = baseMonth === 11 ? baseYear + 1 : baseYear;

  const prevMonth = () => {
    if (baseMonth === 0) { setBaseMonth(11); setBaseYear(y => y - 1); }
    else setBaseMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (baseMonth === 11) { setBaseMonth(0); setBaseYear(y => y + 1); }
    else setBaseMonth(m => m + 1);
  };

  const handleSelect = (d: Date) => {
    if (!checkin || (checkin && checkout)) {
      setCheckin(d); setCheckout(null);
    } else {
      if (d > checkin) setCheckout(d);
      else { setCheckin(d); setCheckout(null); }
    }
  };

  const nights = checkin && checkout
    ? Math.round((checkout.getTime() - checkin.getTime()) / 86400000)
    : 0;
  const priceInput = { pricePerNight, nightlyPriceOverrides, pricing };
  const stay =
    nights > 0 && checkin && checkout ? quoteStay(priceInput, localISO(checkin), localISO(checkout)) : null;
  const subtotal = stay ? Math.round(stay.staySubtotal + cleaningFee) : 0;
  const taxes = computeStayTax(tax, subtotal);
  const total = subtotal + taxes.addedMxn;
  const lengthErr =
    nights > 0 && checkin && checkout
      ? stayLengthError(priceInput, nights, fullMonthsBetween(localISO(checkin), localISO(checkout)).months)
      : null;

  const fmtDate = (d: Date) => `${d.getDate()} ${t(MONTHS[d.getMonth()]).slice(0,3)} ${d.getFullYear()}`;

  return (
    <div>
      {/* Date display */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        {[
          { label: "Entrada", val: checkin, placeholder: "Agregar fecha" },
          { label: "Salida", val: checkout, placeholder: "Agregar fecha" },
        ].map((f) => (
          <div
            key={f.label}
            className="rounded border px-3 py-2"
            style={{ borderColor: "#ebebeb" }}
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-[#484848]">{t(f.label)}</div>
            <div className="mt-0.5 text-sm" style={{ color: f.val ? "#484848" : "#aaa" }}>
              {f.val ? fmtDate(f.val) : t(f.placeholder)}
            </div>
          </div>
        ))}
      </div>

      {/* Calendar navigation */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth} className="p-1 text-[#484848] hover:text-[#dcb81e]">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button type="button" onClick={nextMonth} className="p-1 text-[#484848] hover:text-[#dcb81e]">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Two months */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <CalendarMonth year={baseYear} month={baseMonth} checkin={checkin} checkout={checkout} hover={hover}
          blocked={blockedDates} today={today} onSelect={handleSelect} onHover={setHover} />
        <CalendarMonth year={year2} month={month2} checkin={checkin} checkout={checkout} hover={hover}
          blocked={blockedDates} today={today} onSelect={handleSelect} onHover={setHover} />
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#aaa]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: "#c5e3e7" }} />
          {t("Fechas reservadas")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: "#dcb81e" }} />
          {t("Seleccionado")}
        </span>
      </div>

      {/* Clear button */}
      {(checkin || checkout) && (
        <button
          type="button"
          onClick={() => { setCheckin(null); setCheckout(null); }}
          className="mt-2 text-xs text-[#aaa] underline hover:text-[#484848]"
        >
          {t("Limpiar fechas")}
        </button>
      )}

      {/* Price summary */}
      {nights > 0 && stay && (
        <div className="mt-4 rounded border p-4 text-sm" style={{ borderColor: "#ebebeb" }}>
          {stay.months && stay.monthPrice ? (
            <>
              <div className="flex justify-between text-[#3a3a3a]">
                <span>
                  ${stay.monthPrice.toLocaleString("es-MX")} ×{" "}
                  {stay.months === 1 ? t("1 mes") : t("{n} meses", { n: stay.months })}
                </span>
                <span>${(stay.monthPrice * stay.months).toLocaleString("es-MX")}</span>
              </div>
              {(stay.extraNights ?? 0) > 0 && (
                <div className="flex justify-between text-[#3a3a3a]">
                  <span>{t("+ {n} noches extra", { n: stay.extraNights ?? 0 })}</span>
                  <span>
                    ${Math.round(stay.nightsSubtotal - stay.monthPrice * stay.months).toLocaleString("es-MX")}
                  </span>
                </div>
              )}
            </>
          ) : stay.sameRate ? (
            <div className="flex justify-between text-[#3a3a3a]">
              <span>
                ${Math.round(stay.nightsSubtotal / nights).toLocaleString("es-MX")} × {t("{n} noches", { n: nights })}
              </span>
              <span>${stay.nightsSubtotal.toLocaleString("es-MX")}</span>
            </div>
          ) : (
            <>
              <p className="mb-2 text-xs text-[#888]">{t("Precio por noche según fecha (definido por el anfitrión).")}</p>
              <div className="flex justify-between text-[#3a3a3a]">
                <span>{t("{n} noches", { n: nights })}</span>
                <span>${stay.nightsSubtotal.toLocaleString("es-MX")}</span>
              </div>
            </>
          )}
          {stay.seasonalDiscountMxn > 0 && (
            <div className="flex justify-between text-[#1e7a3a]">
              <span>{t("Promoción de temporada")}</span>
              <span>−${stay.seasonalDiscountMxn.toLocaleString("es-MX")}</span>
            </div>
          )}
          {stay.discountMxn > 0 && stay.discountKind && (
            <div className="flex justify-between text-[#1e7a3a]">
              <span>{t(DISCOUNT_LABEL[stay.discountKind], { n: stay.discountPct, months: stay.discountMonths ?? 0 })}</span>
              <span>−${stay.discountMxn.toLocaleString("es-MX")}</span>
            </div>
          )}
          {cleaningFee > 0 && (
            <div className="flex justify-between text-[#3a3a3a]">
              <span>{t("Tarifa de limpieza")}</span>
              <span>${cleaningFee}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t pt-2 font-semibold text-[#484848]" style={{ borderColor: "#ebebeb" }}>
            <span>{t("Total")}</span>
            <span>${total.toLocaleString("es-MX")}</span>
          </div>
          {listingId && bookable && !instantBook && (
            <p className="mt-2 rounded bg-[#fdf6d8] px-3 py-2 text-xs leading-relaxed text-[#6b5510]">
              {t(
                "El anfitrión aprueba tu solicitud y confirma el total. Si cambia, te avisamos antes de cobrar o devolver la diferencia. Puedes platicarlo por el chat."
              )}
            </p>
          )}
          {depositMxn > 0 && (
            <p className="mt-2 text-xs text-[#888]">
              {t("Depósito pactado: ${amount} MXN. Se entrega entre ustedes; Cabibee no lo cobra ni lo guarda.", {
                amount: depositMxn.toLocaleString("es-MX"),
              })}
            </p>
          )}
        </div>
      )}

      {listingId && !bookable && (
        <p className="mt-4 rounded border bg-[#f7f7f7] p-3 text-sm leading-relaxed text-[#484848]" style={{ borderColor: "#ebebeb" }}>
          {t("Este anfitrión todavía no recibe reservas dentro de Cabibee. Puedes escribirle por el chat o usar sus datos de contacto.")}
        </p>
      )}

      {listingId && bookable && (
        <div className="mt-4 space-y-3 border-t pt-4 text-left" style={{ borderColor: "#ebebeb" }}>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#484848]">{t("Reserva con cuenta")}</p>
          {sessionLoading && <p className="text-sm text-[#888]">{t("Comprobando sesión…")}</p>}
          {!sessionLoading && !sessionUser && (
            <p className="text-sm leading-relaxed text-[#484848]">
              <Link
                href={loginHref}
                className="font-semibold text-[#dcb81e] underline"
              >
                {t("Inicia sesión")}
              </Link>
              {` ${t("o")} `}
              <Link
                href={registerHref}
                className="font-semibold text-[#dcb81e] underline"
              >
                {t("regístrate")}
              </Link>
              {" "}{t("para solicitar la reserva y pagar el total indicado.")}
            </p>
          )}
          {!sessionLoading && sessionUser && (
            <p className="text-sm text-[#484848]">
              {t("Conectado como")}{" "}
              <span className="font-medium">{sessionUser.fullName?.trim() || sessionUser.email}</span>
            </p>
          )}
          {!sessionLoading && sessionUser && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#484848]">
                {t("Correo electrónico")}
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm font-normal outline-none focus:border-[#dcb81e]"
                  style={{ borderColor: "#ddd" }}
                />
              </label>
              <label className="block text-xs font-semibold text-[#484848]">
                {t("Teléfono (WhatsApp)")}
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={contactPhone}
                  placeholder="+52 55 1234 5678"
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm font-normal outline-none focus:border-[#dcb81e]"
                  style={{ borderColor: "#ddd" }}
                />
              </label>
              <p className="text-xs text-[#888]">{t("El anfitrión los usa para contactarte sobre esta reserva y van en el contrato.")}</p>
            </div>
          )}
        </div>
      )}

      {lengthErr && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {t(lengthErr.key, { n: lengthErr.n })}
        </p>
      )}
      {bookingErr && (
        <div className="mt-3 text-sm text-red-600" role="alert">
          <p>{t(bookingErr)}</p>
          {needsVerificationGate && (
            <p className="mt-2">
              <Link href={membershipHref} className="font-semibold text-[#dcb81e] underline">
                {t("Ir a membresía")}
              </Link>
            </p>
          )}
        </div>
      )}
      {reserveDone && (
        <div
          className="mt-3 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900"
          role="status"
        >
          <p className="font-semibold">
            {reserveDone.needsDemoPayment ? t("Reserva creada — confirma el pago (demo)") : t("Pago registrado")}
          </p>
          <p className="mt-1">
            {t("Código de consulta:")}{" "}
            <span className="font-mono text-lg tracking-widest">{reserveDone.token}</span>
          </p>
          {reserveDone.needsDemoPayment ? (
            <button
              type="button"
              className="mt-3 w-full rounded bg-black py-2.5 text-sm font-semibold text-white"
              onClick={async () => {
                setBookingErr(null);
                setBookingBusy(true);
                try {
                  const res = await fetch(`/api/bookings/${reserveDone.bookingId}/simulate-payment`, {
                    method: "POST",
                    credentials: "include",
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setBookingErr(typeof data.error === "string" ? data.error : "No se pudo confirmar.");
                    return;
                  }
                  setReserveDone((prev) =>
                    prev ? { ...prev, needsDemoPayment: false } : prev
                  );
                } catch {
                  setBookingErr("Error de red.");
                } finally {
                  setBookingBusy(false);
                }
              }}
            >
              {t("Confirmar pago (demo)")}
            </button>
          ) : (
            <p className="mt-2 text-xs text-green-800">
              {t("Usa el código en la página de inicio para seguir el estado. Si el anfitrión valida solicitudes, espera su respuesta; si la reserva es automática, ya quedó confirmada según la configuración del anuncio.")}
            </p>
          )}
        </div>
      )}

      {!(listingId && !bookable) && (
      <button
        type="button"
        disabled={
          bookingBusy ||
          Boolean(reserveDone) ||
          Boolean(lengthErr) ||
          Boolean(listingId && (!sessionUser || sessionLoading))
        }
        className="mt-4 w-full rounded py-3 text-sm font-semibold text-black transition hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: "#dcb81e" }}
        onClick={async () => {
          if (!listingId) return;
          setBookingErr(null);
          setNeedsVerificationGate(false);
          if (!checkin || !checkout) {
            setBookingErr("Elige entrada y salida en el calendario.");
            return;
          }
          if (!sessionUser) {
            setBookingErr("Inicia sesión o regístrate para continuar.");
            return;
          }
          const guestEmail = normalizeBookingEmail(contactEmail);
          if (!guestEmail) {
            setBookingErr(BOOKING_EMAIL_ERROR);
            return;
          }
          const guestPhone = normalizeBookingPhone(contactPhone);
          if (!guestPhone) {
            setBookingErr(BOOKING_PHONE_ERROR);
            return;
          }
          setBookingBusy(true);
          try {
            const res = await fetch("/api/bookings/request", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                listingId,
                checkIn: localISO(checkin),
                checkOut: localISO(checkout),
                ref: bookingRef || undefined,
                guestEmail,
                guestPhone,
              }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              if (res.status === 401 && data.needsLogin) {
                setBookingErr("Tu sesión expiró. Vuelve a iniciar sesión.");
              } else if (res.status === 403 && data.needsVerification) {
                setNeedsVerificationGate(true);
                setBookingErr(
                  typeof data.error === "string"
                    ? data.error
                    : "Completa membresía e identidad para poder reservar."
                );
              } else {
                setNeedsVerificationGate(false);
                setBookingErr(typeof data.error === "string" ? data.error : "No se pudo enviar.");
              }
              return;
            }
            const booking = data.booking as { id?: string; token?: string } | undefined;
            if (!booking?.id || !booking?.token) {
              setBookingErr("Respuesta incompleta del servidor.");
              return;
            }
            window.location.assign(`/contrato/${booking.token}?pay=1`);
            return;
          } catch {
            setBookingErr("Error de red. Intenta de nuevo.");
          } finally {
            setBookingBusy(false);
          }
        }}
      >
        {listingId
          ? sessionLoading
            ? "…"
            : !sessionUser
              ? t("Inicia sesión para reservar")
              : bookingBusy
                ? t("Procesando…")
                : reserveDone
                  ? t("Listo")
                  : checkin && checkout
                    ? t("Reservar")
                    : t("Elige fechas primero")
          : checkin && checkout
            ? t("Solicitar una reserva")
            : t("Comprobar disponibilidad")}
      </button>
      )}
    </div>
  );
}
