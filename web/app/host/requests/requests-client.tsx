"use client";

import { useCallback, useEffect, useState } from "react";

type HostListing = { id: string; title: string; published: boolean };

type BookingRow = {
  id: string;
  status: string;
  token: string;
  guestName: string;
  guestEmail: string;
  paidAt?: string;
  checkIn: string;
  checkOut: string;
  hostAdjustedCheckIn?: string;
  hostAdjustedCheckOut?: string;
  hostAdjustedListingId?: string;
  listingId: string;
  listingTitle: string;
  effectiveListingTitle?: string;
  nights: number;
  estimatedTotalMxn: number;
  createdAt: string;
};

const statusLabel: Record<string, string> = {
  AWAITING_PAYMENT: "Esperando pago del huésped",
  PENDING: "Pendiente de tu respuesta",
  AWAITING_DETAILS: "Esperando datos huésped",
  CONFIRMED: "Confirmada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
};

export function HostRequestsClient() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [listings, setListings] = useState<HostListing[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const [bRes, lRes] = await Promise.all([
        fetch("/api/host/bookings", { cache: "no-store" }),
        fetch("/api/host/listings", { cache: "no-store" }),
      ]);
      if (!bRes.ok) {
        setLoadErr("No se pudieron cargar las reservas.");
        return;
      }
      const bData = await bRes.json();
      setBookings(bData.bookings ?? []);
      if (lRes.ok) {
        const lData = await lRes.json();
        setListings(lData.listings ?? []);
      }
    } catch {
      setLoadErr("Error de red.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const publishedListings = listings.filter((l) => l.published);

  return (
    <div className="max-w-4xl">
      {loadErr && <p className="text-sm text-red-600">{loadErr}</p>}

      <div className="mt-6 space-y-6">
        {bookings.length === 0 && !loadErr && (
          <p className="text-sm text-[#888]">Aún no hay solicitudes de reserva.</p>
        )}
        {bookings.map((b) => {
          const pending = b.status === "PENDING";
          const awaitingPay = b.status === "AWAITING_PAYMENT";
          return (
            <div
              key={b.id}
              className="rounded border bg-white p-5 text-sm shadow-sm"
              style={{ borderColor: "#ebebeb" }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#484848]">{b.effectiveListingTitle ?? b.listingTitle}</p>
                  <p className="mt-1 text-[#888]">
                    {b.guestName} · {b.guestEmail}
                  </p>
                  <p className="mt-2 text-[#3a3a3a]">
                    Solicitado: {b.checkIn} → {b.checkOut} ({b.nights} noches)
                  </p>
                  <p className="mt-1">
                    Total estimado:{" "}
                    <span className="font-medium">${b.estimatedTotalMxn.toLocaleString("es-MX")} MXN</span>
                    {b.paidAt && (
                      <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-900">
                        Pagado
                      </span>
                    )}
                  </p>
                  <p className="mt-2 text-xs text-[#aaa]">
                    Código huésped: <span className="font-mono tracking-wide">{b.token}</span>
                  </p>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: pending ? "#fef3c7" : awaitingPay ? "#e0f2fe" : "#f3f4f6",
                    color: "#484848",
                  }}
                >
                  {statusLabel[b.status] ?? b.status}
                </span>
              </div>

              {pending && (
                <PendingActions
                  booking={b}
                  publishedListings={publishedListings}
                  acting={acting}
                  setActing={setActing}
                  onDone={() => void load()}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PendingActions({
  booking,
  publishedListings,
  acting,
  setActing,
  onDone,
}: {
  booking: BookingRow;
  publishedListings: HostListing[];
  acting: string | null;
  setActing: (id: string | null) => void;
  onDone: () => void;
}) {
  const [adjIn, setAdjIn] = useState(booking.checkIn);
  const [adjOut, setAdjOut] = useState(booking.checkOut);
  const [adjListingId, setAdjListingId] = useState(booking.listingId);

  const listingOptions: HostListing[] =
    publishedListings.length > 0
      ? publishedListings
      : [{ id: booking.listingId, title: booking.listingTitle, published: true }];

  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: "#ebebeb" }}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#aaa]">
        Ajustes antes de aceptar (opcional)
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className="text-xs text-[#888]">Entrada</span>
          <input
            type="date"
            value={adjIn}
            onChange={(e) => setAdjIn(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-2 text-sm"
            style={{ borderColor: "#ebebeb" }}
          />
        </label>
        <label>
          <span className="text-xs text-[#888]">Salida</span>
          <input
            type="date"
            value={adjOut}
            onChange={(e) => setAdjOut(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-2 text-sm"
            style={{ borderColor: "#ebebeb" }}
          />
        </label>
        <label>
          <span className="text-xs text-[#888]">Alojamiento</span>
          <select
            value={adjListingId}
            onChange={(e) => setAdjListingId(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-2 text-sm text-[#484848]"
            style={{ borderColor: "#ebebeb" }}
          >
            {listingOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={acting === booking.id}
          className="rounded bg-[#dcb81e] px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          onClick={async () => {
            setActing(booking.id);
            try {
              const body: Record<string, string> = { action: "accept" };
              if (adjIn !== booking.checkIn) body.hostAdjustedCheckIn = adjIn;
              if (adjOut !== booking.checkOut) body.hostAdjustedCheckOut = adjOut;
              if (adjListingId !== booking.listingId) body.hostAdjustedListingId = adjListingId;
              const res = await fetch(`/api/host/bookings/${booking.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                alert(typeof data.error === "string" ? data.error : "No se pudo aceptar.");
                return;
              }
              onDone();
            } finally {
              setActing(null);
            }
          }}
        >
          Aceptar solicitud
        </button>
        <button
          type="button"
          disabled={acting === booking.id}
          className="rounded border border-[#ebebeb] px-5 py-2.5 text-sm font-medium text-[#484848] disabled:opacity-50"
          onClick={async () => {
            if (!confirm("¿Rechazar esta solicitud?")) return;
            setActing(booking.id);
            try {
              const res = await fetch(`/api/host/bookings/${booking.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reject" }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                alert(typeof data.error === "string" ? data.error : "No se pudo rechazar.");
                return;
              }
              onDone();
            } finally {
              setActing(null);
            }
          }}
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}
