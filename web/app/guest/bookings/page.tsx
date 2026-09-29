"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BookingDepositPanel } from "@/components/booking-deposit-panel";
import { BookingReviewPanel } from "@/components/booking-review-panel";
import { BookingScreeningPanel } from "@/components/booking-screening-panel";
import type { BookingDepositRecord } from "@/lib/booking-deposit-types";
import type { ScreeningPublicView, ScreeningQuote } from "@/lib/screening-types";
import type { StayReviewRecord } from "@/lib/stay-review-types";

type Row = {
  id: string;
  status: string;
  token: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  estimatedTotalMxn: number;
  paidAt?: string;
  refundedAt?: string;
  refundAmountMxn?: number;
  listingTitle: string;
  listingSlug?: string;
  contract?: {
    guestAcceptedAt?: string;
    hostAcceptedAt?: string;
  };
  deposit?: BookingDepositRecord;
  canReview?: boolean;
  myReview?: StayReviewRecord;
  hostReviewOfMe?: StayReviewRecord;
  screening?: ScreeningPublicView | null;
};

const labels: Record<string, string> = {
  AWAITING_PAYMENT: "Esperando pago",
  PENDING: "Pendiente anfitrión",
  AWAITING_DETAILS: "Acepta el contrato",
  CONFIRMED: "Confirmada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
};

export default function GuestBookingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [consentText, setConsentText] = useState("");
  const [quote, setQuote] = useState<ScreeningQuote>();

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
      setConsentText(typeof data.screeningConsentText === "string" ? data.screeningConsentText : "");
      if (data.screeningQuote) setQuote(data.screeningQuote);
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
      <p className="mt-2 text-sm text-[#888]">Historial y estado de cada solicitud.</p>
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
                  {b.paidAt && !b.refundedAt && (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-900">
                      Pagado
                    </span>
                  )}
                  {b.refundedAt && (
                    <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-900">
                      Reembolsado
                    </span>
                  )}
                </p>
                {b.refundedAt && (
                  <p className="mt-2 text-sm text-[#3a3a3a]">
                    Te devolvimos{" "}
                    <span className="font-medium">
                      ${(b.refundAmountMxn ?? 0).toLocaleString("es-MX")} MXN
                    </span>{" "}
                    el {b.refundedAt.slice(0, 10)}. Tu banco puede tardar de 5 a 10 días en reflejarlo.
                  </p>
                )}
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
              {(b.status === "AWAITING_DETAILS" ||
                (b.contract && !b.contract.guestAcceptedAt && b.status === "CONFIRMED")) && (
                <Link href={`/contrato/${b.token}`} className="text-sm font-medium text-[#dcb81e] underline">
                  Firmar contrato
                </Link>
              )}
              {b.contract && (
                <>
                  <Link href={`/contrato/${b.token}`} className="text-sm font-medium text-[#dcb81e] underline">
                    Ver contrato
                  </Link>
                  <a
                    href={`/api/bookings/contract?token=${encodeURIComponent(b.token)}&format=pdf`}
                    className="text-sm font-medium text-[#dcb81e] underline"
                  >
                    Descargar PDF
                  </a>
                </>
              )}
              <Link href={`/finish/${b.token}`} className="text-sm font-medium text-[#888] underline">
                Ver reserva
              </Link>
            </div>
            <BookingScreeningPanel
              bookingId={b.id}
              role="guest"
              screening={b.screening}
              quote={quote}
              consentText={consentText}
              onChanged={() => void load()}
            />
            <BookingDepositPanel
              bookingId={b.id}
              deposit={b.deposit}
              role="guest"
              onChanged={() => void load()}
            />
            <BookingReviewPanel
              bookingId={b.id}
              role="guest"
              canReview={b.canReview}
              myReview={b.myReview}
              otherReview={b.hostReviewOfMe}
              onChanged={() => void load()}
            />
          </div>
        ))}
        {rows.length === 0 && !err && (
          <p className="text-sm text-[#888]">No hay reservas con esta cuenta todavía.</p>
        )}
      </div>
    </div>
  );
}
