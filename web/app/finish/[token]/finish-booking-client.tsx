"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type LookupBooking = {
  status: string;
  token: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  estimatedTotalMxn: number;
  guestName: string;
  listingTitle?: string;
  listingSlug?: string;
  paidAt?: string;
};

export function FinishBookingClient({ token }: { token: string }) {
  const [booking, setBooking] = useState<LookupBooking | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [guestPhone, setGuestPhone] = useState("");
  const [guestFinishNotes, setGuestFinishNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (token.length !== 6) {
      setLoadErr("El código debe tener 6 dígitos.");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadErr(null);
      try {
        const res = await fetch(`/api/bookings/lookup?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setLoadErr(typeof data.error === "string" ? data.error : "No encontrado.");
          return;
        }
        if (!cancelled && data.booking) setBooking(data.booking as LookupBooking);
      } catch {
        if (!cancelled) setLoadErr("Error de red.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loadErr) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-red-600">{loadErr}</p>
        <Link href="/" className="mt-6 inline-block text-sm text-[#dcb81e] underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-[#888]">
        Cargando…
      </div>
    );
  }

  const statusLabels: Record<string, string> = {
    AWAITING_PAYMENT: "Pago pendiente",
    PENDING: "Pendiente de anfitrión",
    AWAITING_DETAILS: "Aprobada — completa tus datos",
    CONFIRMED: "Confirmada",
    REJECTED: "Rechazada",
    CANCELLED: "Cancelada",
    COMPLETED: "Completada",
  };

  const canFinish = booking.status === "AWAITING_DETAILS";

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">Reserva</p>
      <h1 className="mt-1 text-2xl font-semibold text-[#484848]">{booking.listingTitle}</h1>
      <p className="mt-2 text-sm text-[#888]">
        Código <span className="font-mono tracking-widest">{booking.token}</span>
      </p>

      <div className="mt-6 rounded border p-4 text-sm" style={{ borderColor: "#ebebeb" }}>
        <div className="flex justify-between gap-4">
          <span className="text-[#aaa]">Estado</span>
          <span className="font-medium text-[#484848]">
            {statusLabels[booking.status] ?? booking.status}
          </span>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <span className="text-[#aaa]">Entrada — Salida</span>
          <span className="text-[#484848]">
            {booking.checkIn} → {booking.checkOut}
          </span>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <span className="text-[#aaa]">Noches / Total estimado</span>
          <span className="text-[#484848]">
            {booking.nights} · ${booking.estimatedTotalMxn.toLocaleString("es-MX")} MXN
          </span>
        </div>
      </div>

      {canFinish && !saved && (
        <form
          className="mt-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaveErr(null);
            setSaving(true);
            try {
              const res = await fetch("/api/bookings/finish", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  token,
                  guestPhone: guestPhone.trim(),
                  guestFinishNotes: guestFinishNotes.trim(),
                }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                setSaveErr(typeof data.error === "string" ? data.error : "No se pudo guardar.");
                return;
              }
              setSaved(true);
            } catch {
              setSaveErr("Error de red.");
            } finally {
              setSaving(false);
            }
          }}
        >
          <h2 className="text-lg font-semibold text-[#484848]">Datos de contacto</h2>
          <p className="text-sm text-[#888]">
            Opcional: teléfono y notas para el anfitrión.
          </p>
          <label className="block">
            <span className="text-xs text-[#888]">Teléfono</span>
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              style={{ borderColor: "#ebebeb" }}
            />
          </label>
          <label className="block">
            <span className="text-xs text-[#888]">Notas</span>
            <textarea
              value={guestFinishNotes}
              onChange={(e) => setGuestFinishNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              style={{ borderColor: "#ebebeb" }}
            />
          </label>
          {saveErr && (
            <p className="text-sm text-red-600" role="alert">
              {saveErr}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded py-3 text-sm font-semibold text-black disabled:opacity-60"
            style={{ backgroundColor: "#dcb81e" }}
          >
            {saving ? "Guardando…" : "Guardar datos"}
          </button>
        </form>
      )}

      {canFinish && saved && (
        <div className="mt-8 rounded border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          Datos guardados. Te contactará el anfitrión o recibirás los siguientes pasos por correo cuando estén activos.
        </div>
      )}

      {booking.status === "AWAITING_PAYMENT" && (
        <div className="mt-8 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Falta completar el pago</p>
          <p className="mt-2 text-amber-900">
            Con la misma cuenta con la que iniciaste la solicitud, abre el anuncio y pulsa «Reservar y pagar» para seguir el
            checkout (o «Confirmar pago (demo)» si no hay Stripe configurado).
          </p>
          {booking.listingSlug && (
            <Link
              href={`/listings/${booking.listingSlug}`}
              className="mt-3 inline-block font-semibold text-amber-900 underline"
            >
              Ir al anuncio
            </Link>
          )}
        </div>
      )}

      {!canFinish && booking.status !== "AWAITING_PAYMENT" && (
        <p className="mt-8 text-sm text-[#888]">
          {booking.status === "PENDING"
            ? "Tu solicitud está pendiente de revisión por el anfitrión."
            : "No hay acciones pendientes en esta página para el estado actual."}
        </p>
      )}

      <Link href="/" className="mt-10 inline-block text-sm text-[#dcb81e] underline">
        ← Inicio
      </Link>
    </div>
  );
}
