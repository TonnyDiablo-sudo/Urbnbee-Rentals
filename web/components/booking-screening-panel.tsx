"use client";

import { useState } from "react";
import type { ScreeningPayer, ScreeningPublicView, ScreeningQuote } from "@/lib/screening-types";
import {
  SCREENING_BAND_LABEL,
  SCREENING_PAYER_LABEL,
  SCREENING_STATUS_LABEL,
} from "@/lib/screening-types";

export function BookingScreeningPanel({
  bookingId,
  role,
  screening,
  canRequest,
  quote,
  consentText,
  onChanged,
}: {
  bookingId: string;
  role: "guest" | "host";
  screening?: ScreeningPublicView | null;
  canRequest?: boolean;
  quote?: ScreeningQuote;
  consentText?: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [payer, setPayer] = useState<ScreeningPayer>("host");

  if (role === "host" && !screening && !canRequest) return null;
  if (role === "guest" && !screening) return null;

  const currency = quote?.currency === "usd" ? "USD" : "MXN";
  const priceLabel =
    quote && quote.offered && quote.amount > 0
      ? `$${quote.amount.toLocaleString("es-MX")} ${currency}`
      : "sin precio en el catálogo";

  const post = async (url: string, body?: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.error === "string" ? data.error : "No se pudo completar.");
        return data;
      }
      if (typeof data.checkoutUrl === "string" && data.checkoutUrl.startsWith("http")) {
        window.location.assign(data.checkoutUrl);
        return data;
      }
      onChanged();
      return data;
    } catch {
      setErr("Error de red.");
      return {};
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-[#ebebeb] bg-white p-4 text-sm">
      <p className="font-semibold text-[#484848]">Screening de crédito</p>
      <p className="mt-1 text-xs text-[#888]">
        Cabibee pide el reporte a un proveedor y cobra su costo más un margen. El expediente no se
        queda aquí: el anfitrión solo ve un resumen. No somos el buró.
      </p>

      {screening && (
        <div className="mt-3 space-y-1 text-[#3a3a3a]">
          <p>{SCREENING_STATUS_LABEL[screening.status]}</p>
          <p className="text-xs text-[#888]">{SCREENING_PAYER_LABEL[screening.payer]}</p>
          {screening.band && (
            <p>
              Resultado:{" "}
              <span className="font-medium">{SCREENING_BAND_LABEL[screening.band]}</span>
            </p>
          )}
          {screening.providerNote && (
            <p className="text-xs text-[#888]">{screening.providerNote}</p>
          )}
        </div>
      )}

      {role === "host" && canRequest && !screening && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-[#888]">Cargo: {priceLabel} (costo del proveedor + margen de Cabibee).</p>
          <fieldset className="space-y-2 text-xs text-[#484848]">
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name={`scr-payer-${bookingId}`}
                checked={payer === "host"}
                onChange={() => setPayer("host")}
                className="mt-0.5 accent-[#dcb81e]"
              />
              <span>Lo pago yo</span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name={`scr-payer-${bookingId}`}
                checked={payer === "guest"}
                onChange={() => setPayer("guest")}
                className="mt-0.5 accent-[#dcb81e]"
              />
              <span>Se lo cobro al huésped</span>
            </label>
          </fieldset>
          <button
            type="button"
            disabled={busy}
            className="rounded bg-[#dcb81e] px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
            onClick={() => void post(`/api/host/bookings/${bookingId}/screening`, { payer })}
          >
            {busy ? "Pidiendo…" : "Pedir screening"}
          </button>
        </div>
      )}

      {role === "guest" && screening?.needsConsent && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-[#888]">
            {screening.payer === "guest"
              ? `Si autorizas, el cargo es ${priceLabel}.`
              : "Si autorizas, el anfitrión paga este screening."}
          </p>
          <label className="flex items-start gap-2 text-xs text-[#484848]">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 accent-[#dcb81e]"
            />
            <span>{consentText}</span>
          </label>
          <button
            type="button"
            disabled={busy || !accepted}
            className="rounded bg-[#dcb81e] px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
            onClick={() => void post(`/api/guest/screening/${screening.id}/consent`)}
          >
            {busy ? "Guardando…" : "Autorizar screening"}
          </button>
        </div>
      )}

      {role === "guest" && screening?.payer === "host" && screening.consentedAt && !screening.paidAt && (
        <p className="mt-3 text-xs text-[#888]">Ya autorizaste. Falta que el anfitrión pague.</p>
      )}

      {role === "guest" && screening?.needsPayGuest && (
        <div className="mt-3">
          <p className="text-xs text-[#888]">Cargo: {priceLabel}. Es independiente de la membresía.</p>
          <button
            type="button"
            disabled={busy || !quote?.offered}
            className="mt-2 rounded bg-[#dcb81e] px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
            onClick={() => void post(`/api/guest/screening/${screening.id}/checkout`)}
          >
            {busy ? "Abriendo cobro…" : "Pagar screening"}
          </button>
        </div>
      )}

      {role === "host" && screening?.needsPayHost && (
        <div className="mt-3">
          <p className="text-xs text-[#888]">El huésped ya autorizó. Cargo: {priceLabel}.</p>
          <button
            type="button"
            disabled={busy || !quote?.offered}
            className="mt-2 rounded bg-[#dcb81e] px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
            onClick={() => void post(`/api/host/bookings/${bookingId}/screening/checkout`)}
          >
            {busy ? "Abriendo cobro…" : "Pagar screening"}
          </button>
        </div>
      )}

      {role === "host" && screening?.needsPayGuest && (
        <p className="mt-3 text-xs text-[#888]">Esperando que el huésped autorice y pague.</p>
      )}

      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  );
}
