"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GuestPayNote } from "@/components/booking/pay-status";
import { BookingDepositPanel } from "@/components/booking-deposit-panel";
import type { PayConfirmation, PayInstruction, PayProof } from "@/lib/booking-types";
import { BookingReviewPanel } from "@/components/booking-review-panel";
import { BookingScreeningPanel } from "@/components/booking-screening-panel";
import { useLang, useT } from "@/components/i18n-provider";
import type { BookingDepositRecord } from "@/lib/booking-deposit-types";
import { numberLocale } from "@/lib/i18n";
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
  stripeCheckoutSessionId?: string;
  payInstruction?: PayInstruction | null;
  payConfirmation?: PayConfirmation | null;
  payProof?: PayProof | null;
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
  PENDING: "Pendiente de aprobar",
  PENDING_HOST: "Pendiente de aprobar",
  AWAITING_DETAILS: "Acepta el contrato",
  CONFIRMED: "Confirmada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
  EXPIRED: "Expirada",
};

export default function GuestBookingsPage() {
  const t = useT();
  const locale = numberLocale(useLang());
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
      <h1 className="text-2xl font-semibold text-[#484848]">{t("Mis reservas")}</h1>
      <p className="mt-2 text-sm text-[#888]">{t("Historial y estado de cada solicitud.")}</p>
      {err && <p className="mt-4 text-sm text-red-600">{t(err)}</p>}
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
                  {b.checkIn} → {b.checkOut} · {t("{n} noches", { n: b.nights })}
                </p>
                <p className="mt-2 text-sm">
                  {t("Total estimado:")}{" "}
                  <span className="font-medium">${b.estimatedTotalMxn.toLocaleString(locale)} MXN</span>
                  {b.paidAt && !b.refundedAt && (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-900">
                      {t("Pagado")}
                    </span>
                  )}
                  {b.refundedAt && (
                    <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-900">
                      {t("Reembolsado")}
                    </span>
                  )}
                </p>
                {b.refundedAt && (
                  <p className="mt-2 text-sm text-[#3a3a3a]">
                    {t("Te devolvimos")}{" "}
                    <span className="font-medium">
                      ${(b.refundAmountMxn ?? 0).toLocaleString(locale)} MXN
                    </span>{" "}
                    {t("el {date}. Tu banco puede tardar de 5 a 10 días en reflejarlo.", {
                      date: b.refundedAt.slice(0, 10),
                    })}
                  </p>
                )}
              </div>
              <span className="rounded-full bg-[#f5f5f5] px-3 py-1 text-xs font-semibold text-[#484848]">
                {t(labels[b.status] ?? b.status)}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`/guest/bookings/${encodeURIComponent(b.id)}`} className="text-sm font-semibold text-[#222] underline">
                {t("Ver detalles de la reserva")}
              </Link>
              {b.listingSlug && (
                <Link
                  href={`/listings/${b.listingSlug}`}
                  className="text-sm font-medium text-[#dcb81e] underline"
                >
                  {t("Ver anuncio")}
                </Link>
              )}
              {(b.status === "AWAITING_PAYMENT" ||
                b.status === "AWAITING_DETAILS" ||
                (b.contract && !b.contract.guestAcceptedAt && b.status === "CONFIRMED")) &&
                !b.contract?.guestAcceptedAt && (
                <Link
                  href={b.status === "AWAITING_PAYMENT" ? `/contrato/${b.token}?pay=1` : `/contrato/${b.token}`}
                  className="text-sm font-medium text-[#dcb81e] underline"
                >
                  {t("Firmar contrato")}
                </Link>
              )}
              {b.contract && (
                <>
                  <Link href={`/contrato/${b.token}`} className="text-sm font-medium text-[#dcb81e] underline">
                    {t("Ver contrato")}
                  </Link>
                  <a
                    href={`/api/bookings/contract?token=${encodeURIComponent(b.token)}&format=pdf`}
                    className="text-sm font-medium text-[#dcb81e] underline"
                  >
                    {t("Descargar PDF")}
                  </a>
                </>
              )}
              <Link href={`/finish/${b.token}`} className="text-sm font-medium text-[#888] underline">
                {t("Ver reserva")}
              </Link>
            </div>
            {(b.payConfirmation || b.paidAt) && (
              <GuestPayNote
                bookingId={b.id}
                payConfirmation={b.payConfirmation}
                payProof={b.payProof}
                paidAt={b.paidAt}
                stripePaid={Boolean(b.stripeCheckoutSessionId) || b.payConfirmation?.by === "stripe"}
              />
            )}
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
          <p className="text-sm text-[#888]">{t("No hay reservas con esta cuenta todavía.")}</p>
        )}
      </div>
    </div>
  );
}
