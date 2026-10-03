"use client";

import { useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import type { PayConfirmation, PayProof } from "@/lib/booking-types";

const METHOD_NAME: Record<PayConfirmation["method"], string> = {
  stripe: "Stripe",
  clabe: "CLABE",
  zelle: "Zelle",
  cashapp: "Cash App",
  oxxo: "Oxxo",
};

function when(iso: string, lang: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang === "en" ? "en-US" : "es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Comprobante de una reserva que se pagó a mano antes de que el motor fuera sólo en línea. */
function PayProofView({ bookingId, proof }: { bookingId: string; proof: PayProof }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const href = `/api/bookings/${encodeURIComponent(bookingId)}/pay-proof?v=${encodeURIComponent(proof.uploadedAt)}`;
  const pdf = proof.mime === "application/pdf";

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-sm font-semibold text-[#222] underline">
        {t("Ver comprobante")}
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-[#161616]">
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full bg-white px-5 py-2.5 text-base font-semibold text-black"
            >
              {t("Volver")}
            </button>
            <p className="text-sm font-medium text-white">{t("Comprobante de pago")}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {pdf ? (
              <iframe title={t("Comprobante de pago")} src={href} className="h-[80vh] w-full rounded-2xl bg-white" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={href} alt={t("Comprobante de pago")} className="mx-auto w-full max-w-md rounded-2xl bg-white shadow-2xl" />
            )}
          </div>
        </div>
      )}
    </>
  );
}

type PaidProps = {
  bookingId?: string;
  payConfirmation?: PayConfirmation | null;
  payProof?: PayProof | null;
  paidAt?: string | null;
  stripePaid?: boolean;
};

/** Estado del pago ya hecho. Si todavía no paga, no muestra nada: el huésped paga en línea. */
export function GuestPayNote({ bookingId, payConfirmation, payProof, paidAt, stripePaid }: PaidProps) {
  const t = useT();
  const lang = useLang();
  if (payConfirmation?.by === "stripe" || (paidAt && stripePaid && payConfirmation?.by !== "host")) {
    return (
      <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
        {t("Ya se pagó por Stripe el {date}", { date: when(payConfirmation?.at ?? paidAt ?? "", lang) })}
      </p>
    );
  }
  if (payConfirmation?.by === "host") {
    return (
      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
        <p>
          {t("El anfitrión confirmó el pago ({method}) el {date}", {
            method: METHOD_NAME[payConfirmation.method] ?? payConfirmation.method,
            date: when(payConfirmation.at, lang),
          })}
        </p>
        {bookingId && payProof && <PayProofView bookingId={bookingId} proof={payProof} />}
      </div>
    );
  }
  if (paidAt) {
    return (
      <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
        {t("Ya se pagó el {date}", { date: when(paidAt, lang) })}
      </p>
    );
  }
  return null;
}

/** Para el anfitrión: el pago es sólo en línea, así que sólo ve si ya pagó o si falta. */
export function HostPayStatus({ status, ...paid }: PaidProps & { status: string }) {
  const t = useT();
  if (paid.payConfirmation || paid.paidAt) return <GuestPayNote {...paid} />;
  if (status !== "AWAITING_PAYMENT") return null;
  return (
    <div className="rounded-2xl border border-[#ebebeb] p-4">
      <p className="text-[15px] font-semibold text-[#222]">{t("Cobro de la reserva")}</p>
      <p className="mt-1 text-sm leading-relaxed text-[#555]">
        {t("Esperando el pago en línea del huésped. La reserva se confirma sola cuando paga con tarjeta.")}
      </p>
    </div>
  );
}
