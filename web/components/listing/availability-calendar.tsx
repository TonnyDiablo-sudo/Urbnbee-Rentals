"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const DAYS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isInRange(d: Date, start: Date | null, end: Date | null) {
  if (!start || !end) return false;
  return d > start && d < end;
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

function sumStayNights(
  checkin: Date,
  checkout: Date,
  basePrice: number,
  overrides?: Record<string, number>
): { total: number; sameRate: boolean } {
  let total = 0;
  let minP = Infinity;
  let maxP = -Infinity;
  const cursor = new Date(checkin);
  while (cursor < checkout) {
    const iso = localISO(cursor);
    const p = overrides?.[iso] ?? basePrice;
    total += p;
    minP = Math.min(minP, p);
    maxP = Math.max(maxP, p);
    cursor.setDate(cursor.getDate() + 1);
  }
  return { total, sameRate: minP === maxP };
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
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = Array(first).fill(null);
  for (let i = 1; i <= days; i++) cells.push(new Date(year, month, i));

  const effectiveEnd = checkout ?? hover;

  return (
    <div className="min-w-0">
      <div className="mb-3 text-center text-sm font-semibold text-[#484848]">
        {MONTHS[month]} {year}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {DAYS.map((d) => (
          <div key={d} className="py-1 text-xs font-medium text-[#aaa]">{d}</div>
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
          let cursor = disabled ? "default" : "pointer";

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
  /** Si se pasa, el flujo exige usuario registrado y pago antes de confirmar. */
  listingId?: string;
  /** Para cancel_url de Stripe y enlaces de login */
  listingSlug?: string;
};

export function AvailabilityCalendar({
  pricePerNight,
  cleaningFee = 0,
  blockedDates,
  nightlyPriceOverrides,
  listingId,
  listingSlug = "",
}: Props) {
  const today = new Date(); today.setHours(0,0,0,0);
  const [baseMonth, setBaseMonth] = useState(today.getMonth());
  const [baseYear, setBaseYear] = useState(today.getFullYear());
  const [checkin, setCheckin] = useState<Date | null>(null);
  const [checkout, setCheckout] = useState<Date | null>(null);
  const [hover, setHover] = useState<Date | null>(null);
  const [sessionUser, setSessionUser] = useState<{
    fullName: string;
    email: string;
  } | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingErr, setBookingErr] = useState<string | null>(null);
  const [needsVerificationGate, setNeedsVerificationGate] = useState(false);
  const [reserveDone, setReserveDone] = useState<{
    token: string;
    bookingId: string;
    needsDemoPayment: boolean;
  } | null>(null);

  const reservePath = listingSlug ? `/listings/${listingSlug}` : "/";

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
  const stay =
    nights > 0 && checkin && checkout
      ? sumStayNights(checkin, checkout, pricePerNight, nightlyPriceOverrides)
      : null;
  const total = stay ? stay.total + cleaningFee : 0;

  const fmtDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;

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
            <div className="text-xs font-semibold uppercase tracking-wide text-[#484848]">{f.label}</div>
            <div className="mt-0.5 text-sm" style={{ color: f.val ? "#484848" : "#aaa" }}>
              {f.val ? fmtDate(f.val) : f.placeholder}
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
          Fechas reservadas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: "#dcb81e" }} />
          Seleccionado
        </span>
      </div>

      {/* Clear button */}
      {(checkin || checkout) && (
        <button
          type="button"
          onClick={() => { setCheckin(null); setCheckout(null); }}
          className="mt-2 text-xs text-[#aaa] underline hover:text-[#484848]"
        >
          Limpiar fechas
        </button>
      )}

      {/* Price summary */}
      {nights > 0 && stay && (
        <div className="mt-4 rounded border p-4 text-sm" style={{ borderColor: "#ebebeb" }}>
          {stay.sameRate ? (
            <div className="flex justify-between text-[#3a3a3a]">
              <span>
                ${Math.round(stay.total / nights).toLocaleString("es-MX")} × {nights} noches
              </span>
              <span>${stay.total.toLocaleString("es-MX")}</span>
            </div>
          ) : (
            <>
              <p className="mb-2 text-xs text-[#888]">Precio por noche según fecha (definido por el anfitrión).</p>
              <div className="flex justify-between text-[#3a3a3a]">
                <span>{nights} noches</span>
                <span>${stay.total.toLocaleString("es-MX")}</span>
              </div>
            </>
          )}
          {cleaningFee > 0 && (
            <div className="flex justify-between text-[#3a3a3a]">
              <span>Tarifa de limpieza</span>
              <span>${cleaningFee}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t pt-2 font-semibold text-[#484848]" style={{ borderColor: "#ebebeb" }}>
            <span>Total</span>
            <span>${total.toLocaleString("es-MX")}</span>
          </div>
        </div>
      )}

      {listingId && (
        <div className="mt-4 space-y-3 border-t pt-4 text-left" style={{ borderColor: "#ebebeb" }}>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#484848]">Reserva con cuenta</p>
          {sessionLoading && <p className="text-sm text-[#888]">Comprobando sesión…</p>}
          {!sessionLoading && !sessionUser && (
            <p className="text-sm leading-relaxed text-[#484848]">
              <Link
                href={`/login?next=${encodeURIComponent(reservePath)}`}
                className="font-semibold text-[#dcb81e] underline"
              >
                Inicia sesión
              </Link>
              {" o "}
              <Link
                href={`/register?next=${encodeURIComponent(reservePath)}`}
                className="font-semibold text-[#dcb81e] underline"
              >
                regístrate
              </Link>
              {" "}para solicitar la reserva y pagar el total indicado.
            </p>
          )}
          {!sessionLoading && sessionUser && (
            <p className="text-sm text-[#484848]">
              Conectado como{" "}
              <span className="font-medium">{sessionUser.fullName?.trim() || sessionUser.email}</span>
            </p>
          )}
        </div>
      )}

      {bookingErr && (
        <div className="mt-3 text-sm text-red-600" role="alert">
          <p>{bookingErr}</p>
          {needsVerificationGate && (
            <p className="mt-2">
              <Link href="/guest/verification" className="font-semibold text-[#dcb81e] underline">
                Ir a verificación de huésped
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
            {reserveDone.needsDemoPayment ? "Reserva creada — confirma el pago (demo)" : "Pago registrado"}
          </p>
          <p className="mt-1">
            Código de consulta:{" "}
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
              Confirmar pago (demo)
            </button>
          ) : (
            <p className="mt-2 text-xs text-green-800">
              Usa el código en la página de inicio para seguir el estado. Si el anfitrión valida solicitudes, espera su
              respuesta; si la reserva es automática, ya quedó confirmada según la configuración del anuncio.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={
          bookingBusy ||
          Boolean(reserveDone) ||
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
              }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              if (res.status === 401 && data.needsLogin) {
                setBookingErr("Tu sesión expiró. Vuelve a iniciar sesión.");
              } else if (res.status === 403 && data.needsVerification) {
                setNeedsVerificationGate(true);
                setBookingErr(
                  "Activa la verificación de huésped (suscripción mensual) para poder reservar."
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

            const co = await fetch(`/api/bookings/${booking.id}/checkout`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                cancelPath: reservePath,
              }),
            });
            const pay = await co.json().catch(() => ({}));
            if (!co.ok) {
              setBookingErr(typeof pay.error === "string" ? pay.error : "No se pudo iniciar el pago.");
              return;
            }
            if (typeof pay.checkoutUrl === "string" && pay.checkoutUrl.startsWith("http")) {
              window.location.assign(pay.checkoutUrl);
              return;
            }
            if (pay.simulatePayment) {
              setReserveDone({
                token: booking.token,
                bookingId: booking.id,
                needsDemoPayment: true,
              });
              return;
            }
            setBookingErr("No se obtuvo enlace de pago.");
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
              ? "Inicia sesión para reservar"
              : bookingBusy
                ? "Procesando…"
                : reserveDone
                  ? "Listo"
                  : checkin && checkout
                    ? "Reservar y pagar"
                    : "Elige fechas primero"
          : checkin && checkout
            ? "Solicitar una reserva"
            : "Comprobar disponibilidad"}
      </button>
    </div>
  );
}
