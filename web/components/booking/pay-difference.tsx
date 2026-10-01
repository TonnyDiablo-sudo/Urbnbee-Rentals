"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/i18n-provider";

/**
 * Aviso + botón para pagar la diferencia cuando el anfitrión cambió fechas y subió el total.
 * Al volver de Stripe (`?diff_session=`) confirma el pago y avisa con `onPaid`.
 */
export function PayDifference({
  bookingId,
  amountMxn,
  paidMxn,
  token,
  returnPath,
  onPaid,
  compact = false,
}: {
  bookingId: string;
  amountMxn: number;
  paidMxn?: number;
  token?: string;
  returnPath: string;
  onPaid: () => void;
  compact?: boolean;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const onPaidRef = useRef(onPaid);
  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get("diff_session");
    if (!sessionId) return;
    url.searchParams.delete("diff_session");
    window.history.replaceState(null, "", url.pathname + url.search);
    void (async () => {
      setBusy(true);
      try {
        const res = await fetch("/api/bookings/verify-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) setErr(typeof data.error === "string" ? data.error : "No se pudo verificar el pago.");
        else onPaidRef.current();
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const pay = async () => {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/pay-difference`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, returnPath }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.error === "string" ? data.error : "No se pudo iniciar el pago.");
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      onPaid();
    } catch {
      setErr("Error de red.");
    } finally {
      setBusy(false);
    }
  };

  const amount = `$${amountMxn.toLocaleString("es-MX")}`;
  return (
    <div className={`rounded-xl border border-amber-200 bg-amber-50 text-amber-950 ${compact ? "p-3 text-[13px]" : "p-4 text-sm"}`}>
      <p className="font-semibold">{t("El anfitrión cambió las fechas: falta pagar {amount} MXN", { amount })}</p>
      <p className="mt-1 leading-relaxed">
        {paidMxn
          ? t("Ya pagaste ${paid}. Tu reserva se confirma cuando pagues la diferencia y firmes el contrato nuevo.", {
              paid: paidMxn.toLocaleString("es-MX"),
            })
          : t("Tu reserva se confirma cuando pagues la diferencia y firmes el contrato nuevo.")}
      </p>
      {err && (
        <p className="mt-2 text-red-700" role="alert">
          {t(err)}
        </p>
      )}
      <button
        type="button"
        onClick={() => void pay()}
        disabled={busy}
        className="mt-3 w-full rounded-lg bg-[#222] py-2.5 font-semibold text-white disabled:opacity-60"
      >
        {busy ? t("Procesando…") : t("Pagar diferencia de {amount}", { amount })}
      </button>
    </div>
  );
}
