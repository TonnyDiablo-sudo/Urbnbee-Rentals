"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BookingDepositPanel } from "@/components/booking-deposit-panel";
import { BookingReviewPanel } from "@/components/booking-review-panel";
import { BookingScreeningPanel } from "@/components/booking-screening-panel";
import type { BookingDepositRecord } from "@/lib/booking-deposit-types";
import type { ScreeningPublicView, ScreeningQuote } from "@/lib/screening-types";
import type { StayReviewRecord } from "@/lib/stay-review-types";

type HostListing = { id: string; title: string; published: boolean };

type BookingRow = {
  id: string;
  status: string;
  token: string;
  guestName: string;
  guestEmail: string;
  paidAt?: string;
  refundedAt?: string;
  refundAmountMxn?: number;
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
  contract?: {
    generatedAt?: string;
    guestAcceptedAt?: string;
    hostAcceptedAt?: string;
  };
  deposit?: BookingDepositRecord;
  canReview?: boolean;
  myReview?: StayReviewRecord;
  guestReviewOfListing?: StayReviewRecord;
  screening?: ScreeningPublicView | null;
  canRequestScreening?: boolean;
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
  const [quote, setQuote] = useState<ScreeningQuote | undefined>();

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
      if (bData.screeningQuote) setQuote(bData.screeningQuote);
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

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (!sessionId?.startsWith("cs_")) return;
    let cancelled = false;
    (async () => {
      await fetch("/api/guest/screening/verify-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
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
                    {b.paidAt && !b.refundedAt && (
                      <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-900">
                        Pagado
                      </span>
                    )}
                    {b.refundedAt && (
                      <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-900">
                        Reembolsado al huésped
                      </span>
                    )}
                  </p>
                  <p className="mt-2 text-xs text-[#aaa]">
                    Código huésped: <span className="font-mono tracking-wide">{b.token}</span>
                  </p>
                  <p className="mt-2 text-xs text-[#3a3a3a]">
                    <Link href={`/contrato/${b.token}`} className="font-medium text-[#dcb81e] underline">
                      Ver contrato
                    </Link>
                    {b.contract && (
                      <>
                        {" · "}
                        {b.contract.hostAcceptedAt && b.contract.guestAcceptedAt
                          ? "firmado por ambas partes"
                          : b.contract.hostAcceptedAt
                            ? "falta firma del huésped"
                            : "falta tu firma"}
                        {" · "}
                        <a
                          href={`/api/bookings/contract?id=${encodeURIComponent(b.id)}&format=pdf`}
                          className="font-medium text-[#dcb81e] underline"
                        >
                          PDF
                        </a>
                      </>
                    )}
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
              {!pending && b.contract && !b.contract.hostAcceptedAt && (
                <HostSignOnly bookingId={b.id} acting={acting} setActing={setActing} onDone={() => void load()} />
              )}
              {!pending && b.contract && (
                <HostContractText bookingId={b.id} />
              )}
              <BookingScreeningPanel
                bookingId={b.id}
                role="host"
                screening={b.screening}
                canRequest={b.canRequestScreening}
                quote={quote}
                onChanged={() => void load()}
              />
              <BookingDepositPanel
                bookingId={b.id}
                deposit={b.deposit}
                role="host"
                onChanged={() => void load()}
              />
              <BookingReviewPanel
                bookingId={b.id}
                role="host"
                canReview={b.canReview}
                myReview={b.myReview}
                otherReview={b.guestReviewOfListing}
                onChanged={() => void load()}
              />
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
  const [lines, setLines] = useState<string[]>([]);
  const [signName, setSignName] = useState("");
  const [acceptContract, setAcceptContract] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/host/bookings/${booking.id}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!cancelled && Array.isArray(data.lines)) setLines(data.lines);
    })();
    return () => {
      cancelled = true;
    };
  }, [booking.id]);

  const listingOptions: HostListing[] =
    publishedListings.length > 0
      ? publishedListings
      : [{ id: booking.listingId, title: booking.listingTitle, published: true }];

  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: "#ebebeb" }}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#aaa]">
        Ajustes antes de aceptar (opcional)
      </p>
      <p className="mb-3 text-xs text-[#888]">
        Revisa el contrato con los datos del huésped (su cuenta) y los tuyos (la plantilla del
        anuncio). Al aceptar lo firmas.
      </p>
      {lines.length > 0 && (
        <pre
          className="mb-4 max-h-56 overflow-auto whitespace-pre-wrap rounded border bg-[#fafafa] p-3 text-xs leading-relaxed text-[#3a3a3a]"
          style={{ borderColor: "#ebebeb" }}
        >
          {lines.join("\n")}
        </pre>
      )}
      <label className="mb-3 block">
        <span className="text-xs text-[#888]">Tu nombre legal (firma)</span>
        <input
          value={signName}
          onChange={(e) => setSignName(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
          style={{ borderColor: "#ebebeb" }}
        />
      </label>
      <label className="mb-4 flex items-start gap-2 text-sm text-[#484848]">
        <input
          type="checkbox"
          checked={acceptContract}
          onChange={(e) => setAcceptContract(e.target.checked)}
          className="mt-1 accent-[#dcb81e]"
        />
        <span>He leído este contrato y lo firmo como anfitrión.</span>
      </label>
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
          disabled={acting === booking.id || !acceptContract || signName.trim().length < 3}
          className="rounded bg-[#dcb81e] px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          onClick={async () => {
            setActing(booking.id);
            try {
              const body: Record<string, unknown> = {
                action: "accept",
                acceptContract: true,
                signName: signName.trim(),
              };
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
          Firmar y aceptar
        </button>
        <button
          type="button"
          disabled={acting === booking.id}
          className="rounded border border-[#ebebeb] px-5 py-2.5 text-sm font-medium text-[#484848] disabled:opacity-50"
          onClick={async () => {
            const msg = booking.paidAt
              ? "Al rechazar se devuelve al huésped el total que pagó, incluido el cargo de servicio. ¿Continuar?"
              : "¿Rechazar esta solicitud?";
            if (!confirm(msg)) return;
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

function HostContractText({ bookingId }: { bookingId: string }) {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/host/bookings/${bookingId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!cancelled && Array.isArray(data.lines)) setLines(data.lines);
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);
  if (!lines.length) return null;
  return (
    <pre
      className="mt-4 max-h-56 overflow-auto whitespace-pre-wrap rounded border bg-[#fafafa] p-3 text-xs leading-relaxed text-[#3a3a3a]"
      style={{ borderColor: "#ebebeb" }}
    >
      {lines.join("\n")}
    </pre>
  );
}

function HostSignOnly({
  bookingId,
  acting,
  setActing,
  onDone,
}: {
  bookingId: string;
  acting: string | null;
  setActing: (id: string | null) => void;
  onDone: () => void;
}) {
  const [signName, setSignName] = useState("");
  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: "#ebebeb" }}>
      <p className="mb-2 text-sm font-medium text-[#484848]">Falta tu firma en este contrato</p>
      <input
        value={signName}
        onChange={(e) => setSignName(e.target.value)}
        placeholder="Tu nombre legal"
        className="w-full rounded border px-3 py-2 text-sm"
        style={{ borderColor: "#ebebeb" }}
      />
      <button
        type="button"
        disabled={acting === bookingId || signName.trim().length < 3}
        className="mt-3 rounded bg-[#dcb81e] px-5 py-2 text-sm font-semibold text-black disabled:opacity-50"
        onClick={async () => {
          setActing(bookingId);
          try {
            const res = await fetch(`/api/host/bookings/${bookingId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "sign", signName: signName.trim() }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              alert(typeof data.error === "string" ? data.error : "No se pudo firmar.");
              return;
            }
            onDone();
          } finally {
            setActing(null);
          }
        }}
      >
        Firmar contrato
      </button>
    </div>
  );
}
