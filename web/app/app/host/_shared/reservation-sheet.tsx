"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { SCREENING_BAND_LABEL, SCREENING_PAYER_LABEL, SCREENING_STATUS_LABEL } from "@/lib/screening-types";
import { revalidate } from "../../_components/cached-fetch";
import { HOST_STATUS, TONE_CLS, fmtDay, fmtMxn } from "../../_components/booking-status";
import { Sheet } from "../../_components/sheet";
import { WebLink } from "../../_components/site-origin";
import { HostManualPay } from "@/components/booking/manual-pay";
import { HOST_URLS, hostChatHref, isPending, stayOf, type HostBooking } from "./host-data";

/** Detalle de una reserva: quién viene, cuándo, cuánto y cómo escribirle. */
export function ReservationSheet({
  booking,
  onClose,
  onReview,
}: {
  booking: HostBooking | null;
  onClose: () => void;
  /** Si viene, las solicitudes pendientes muestran «Revisar y aceptar». */
  onReview?: (b: HostBooking) => void;
}) {
  const t = useT();
  const lang = useLang();
  if (!booking) return null;
  const stay = stayOf(booking);
  const st = HOST_STATUS[booking.status] ?? { label: booking.status, tone: "off" as const };
  const chat = hostChatHref(booking);
  const payout = booking.estimatedTotalMxn;

  return (
    <Sheet open onClose={onClose} title={t("Reservación")}>
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#111] text-lg font-bold text-[#dcb81e]">
            {booking.guestName.trim().charAt(0).toUpperCase() || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-[#222]">{booking.guestName}</p>
            <p className="truncate text-sm text-[#717171]">{stay.title}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE_CLS[st.tone]}`}>{t(st.label)}</span>
        </div>

        <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-[#ebebeb]">
          <div className="border-r border-[#ebebeb] p-3">
            <p className="text-xs font-semibold uppercase text-[#717171]">{t("Llegada")}</p>
            <p className="mt-0.5 text-[15px] text-[#222]">{fmtDay(stay.checkIn, lang)}</p>
          </div>
          <div className="p-3">
            <p className="text-xs font-semibold uppercase text-[#717171]">{t("Salida")}</p>
            <p className="mt-0.5 text-[15px] text-[#222]">{fmtDay(stay.checkOut, lang)}</p>
          </div>
        </div>

        <dl className="space-y-2 text-[15px]">
          <Row label={t("Noches")} value={String(booking.nights)} />
          <Row label={t("Estancia y limpieza")} value={fmtMxn(payout)} />
          <Row label={t("Pago")} value={booking.paidAt ? t("Pagado") : t("Sin pagar")} />
          <Row label={t("Código de reservación")} value={booking.token} />
          {booking.guestEmail && <Row label={t("Correo")} value={booking.guestEmail} />}
          {booking.guestPhone && <Row label={t("Teléfono")} value={booking.guestPhone} />}
        </dl>

        <HostManualPay
          bookingId={booking.id}
          status={booking.status}
          paidAt={booking.paidAt}
          stripePaid={Boolean(booking.stripeCheckoutSessionId)}
          payInstruction={booking.payInstruction}
          payConfirmation={booking.payConfirmation}
          onChanged={() => {
            void revalidate(HOST_URLS.bookings);
          }}
        />

        {booking.guestUserId && !CLOSED_STATUSES.has(booking.status) && <ScreeningBox bookingId={booking.id} />}

        <div className="grid gap-2">
          {isPending(booking.status) && onReview && (
            <button
              type="button"
              onClick={() => onReview(booking)}
              className="w-full rounded-xl bg-[#dcb81e] py-3 text-[15px] font-semibold text-black"
            >
              {t("Revisar y aceptar")}
            </button>
          )}
          {chat && (
            <Link href={chat} className="w-full rounded-xl border border-[#222] py-3 text-center text-[15px] font-semibold text-[#222]">
              {t("Enviar mensaje al huésped")}
            </Link>
          )}
        </div>
      </div>
    </Sheet>
  );
}

const CLOSED_STATUSES = new Set(["REJECTED", "CANCELLED", "EXPIRED", "COMPLETED"]);

type ScreeningState = {
  screening: {
    status: string;
    payer: "host" | "guest";
    band?: string;
    providerNote?: string;
    needsConsent: boolean;
    needsPayGuest: boolean;
    needsPayHost: boolean;
  } | null;
  canRequest: boolean;
  quote?: { offered: boolean; amount: number; currency: "mxn" | "usd" };
};

/** Revisión crediticia del huésped: el anfitrión la pide y decide quién la paga. */
function ScreeningBox({ bookingId }: { bookingId: string }) {
  const t = useT();
  const [data, setData] = useState<ScreeningState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const url = `/api/host/bookings/${encodeURIComponent(bookingId)}/screening`;

  useEffect(() => {
    let cancelled = false;
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !cancelled && setData(j))
      .catch(() => !cancelled && setData(null));
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!data) return null;
  const s = data.screening;
  const price =
    data.quote?.offered && data.quote.amount > 0
      ? `$${data.quote.amount.toLocaleString("es-MX")} ${data.quote.currency.toUpperCase()}`
      : null;

  const request = async (payer: "host" | "guest") => {
    setBusy(true);
    setErr(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payer }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setErr(typeof j.error === "string" ? j.error : "No se pudo pedir la revisión.");
      return;
    }
    setData((d) => (d ? { ...d, screening: j.screening, canRequest: false } : d));
  };

  return (
    <div className="rounded-2xl border border-[#ebebeb] p-4">
      <p className="text-[15px] font-semibold text-[#222]">{t("Historial crediticio")}</p>
      {!s ? (
        data.canRequest && price ? (
          <>
            <p className="mt-1 text-sm text-[#717171]">
              {t("Pide una revisión de crédito ({price}). El huésped tiene que autorizarla; tú decides quién la paga.", { price })}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void request("host")}
                className="rounded-xl border border-[#222] py-2.5 text-sm font-semibold text-[#222] disabled:opacity-50"
              >
                {t("La pago yo")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void request("guest")}
                className="rounded-xl bg-[#222] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t("Que la pague el huésped")}
              </button>
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-[#717171]">{t("La revisión de crédito no está disponible por ahora.")}</p>
        )
      ) : (
        <>
          <p className="mt-1 text-sm text-[#333]">
            {s.status === "completed" && s.band
              ? t("Resultado: {band}", { band: t(SCREENING_BAND_LABEL[s.band as keyof typeof SCREENING_BAND_LABEL] ?? s.band) })
              : s.needsConsent
                ? t("Esperando a que el huésped la autorice. Ya le avisamos.")
                : s.needsPayGuest
                  ? t("El huésped autorizó; falta que pague la consulta.")
                  : s.needsPayHost
                    ? t("El huésped autorizó. Paga la consulta para ver el resultado.")
                    : t(SCREENING_STATUS_LABEL[s.status as keyof typeof SCREENING_STATUS_LABEL] ?? s.status)}
          </p>
          <p className="mt-0.5 text-xs text-[#888]">{t(SCREENING_PAYER_LABEL[s.payer])}</p>
          {s.needsPayHost && (
            <WebLink
              path="/host/requests"
              className="mt-3 inline-block rounded-xl bg-[#dcb81e] px-4 py-2.5 text-sm font-semibold text-black"
            >
              {t("Pagar consulta")}
            </WebLink>
          )}
        </>
      )}
      {err && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{t(err)}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[#717171]">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-[#222]">{value}</dd>
    </div>
  );
}
