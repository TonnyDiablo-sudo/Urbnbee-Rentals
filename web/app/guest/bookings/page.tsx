"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  status: string;
  token: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  estimatedTotalMxn: number;
  paidAt?: string;
  listingTitle: string;
  listingSlug?: string;
};

const labels: Record<string, string> = {
  AWAITING_PAYMENT: "Esperando pago",
  PENDING: "Pendiente anfitrión",
  AWAITING_DETAILS: "Completa datos",
  CONFIRMED: "Confirmada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
};

export default function GuestBookingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/guest/bookings", { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Error");
        return;
      }
      setRows(data.bookings ?? []);
    } catch {
      setErr("Error de red.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-[#484848]">Mis reservas</h1>
      <p className="mt-2 text-sm text-[#888]">
        Historial y estado de cada solicitud. El código de 6 dígitos sirve para consultar sin iniciar sesión en la página de
        inicio.
      </p>
      {err && <p className="mt-4 text-sm text-red-600">{err}</p>}
      <div className="mt-8 space-y-4">
        {rows.map((b) => (
          <div
            key={b.id}
            className="rounded-xl border border-[#ebebeb] bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[#484848]">{b.listingTitle}</p>
                <p className="mt-1 text-sm text-[#3a3a3a]">
                  {b.checkIn} → {b.checkOut} · {b.nights} noches
                </p>
                <p className="mt-2 text-sm">
                  Total estimado:{" "}
                  <span className="font-medium">${b.estimatedTotalMxn.toLocaleString("es-MX")} MXN</span>
                  {b.paidAt && (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-900">
                      Pagado
                    </span>
                  )}
                </p>
                <p className="mt-2 font-mono text-xs tracking-wide text-[#aaa]">
                  Código: {b.token}
                </p>
              </div>
              <span className="rounded-full bg-[#f5f5f5] px-3 py-1 text-xs font-semibold text-[#484848]">
                {labels[b.status] ?? b.status}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {b.listingSlug && (
                <Link
                  href={`/listings/${b.listingSlug}`}
                  className="text-sm font-medium text-[#dcb81e] underline"
                >
                  Ver anuncio
                </Link>
              )}
              <Link href={`/finish/${b.token}`} className="text-sm font-medium text-[#dcb81e] underline">
                Detalle / datos (token)
              </Link>
            </div>
          </div>
        ))}
        {rows.length === 0 && !err && (
          <p className="text-sm text-[#888]">No hay reservas con esta cuenta todavía.</p>
        )}
      </div>
    </div>
  );
}
