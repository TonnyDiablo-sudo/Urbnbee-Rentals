"use client";

import Link from "next/link";
import { useLang, useT } from "@/components/i18n-provider";
import { HOST_STATUS, TONE_CLS, fmtDay, fmtMxn } from "../../_components/booking-status";
import { Sheet } from "../../_components/sheet";
import { hostChatHref, isPending, stayOf, type HostBooking } from "./host-data";

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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[#717171]">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-[#222]">{value}</dd>
    </div>
  );
}
