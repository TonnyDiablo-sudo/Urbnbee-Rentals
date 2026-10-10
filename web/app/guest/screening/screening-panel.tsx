"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookingScreeningPanel } from "@/components/booking-screening-panel";
import { useT } from "@/components/i18n-provider";
import type { ScreeningPublicView, ScreeningQuote } from "@/lib/screening-types";

export function GuestScreeningPanel() {
  const t = useT();
  const searchParams = useSearchParams();
  const [cases, setCases] = useState<ScreeningPublicView[]>([]);
  const [quote, setQuote] = useState<ScreeningQuote | undefined>();
  const [consentText, setConsentText] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/guest/screening", { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setErr(typeof data.error === "string" ? data.error : "No se pudo cargar.");
        return;
      }
      setCases(data.cases ?? []);
      setQuote(data.quote);
      setConsentText(typeof data.consentText === "string" ? data.consentText : "");
    } catch {
      setErr("Error de red.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId?.startsWith("cs_")) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/guest/screening/verify-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!cancelled) await load();
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setErr(typeof data.error === "string" ? data.error : "No se pudo confirmar el pago.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, load]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-[#484848]">{t("Screening")}</h1>
      <p className="mt-2 text-sm text-[#888]">
        {t("Si un anfitrión te lo pide, autorizas aquí y confirmas con tu NIP en la página del proveedor. Cabibee solo guarda el resumen, nunca tu reporte completo ni tu score.")}
      </p>
      {err && <p className="mt-4 text-sm text-red-600">{t(err)}</p>}
      <div className="mt-8 space-y-4">
        {cases.map((row) => (
          <div key={row.id} className="rounded-xl border border-[#ebebeb] bg-white p-5 shadow-sm">
            <p className="text-xs text-[#aaa]">
              {row.bookingId ? t("Reserva {id}", { id: row.bookingId }) : t("Sin reserva ligada")}
            </p>
            <BookingScreeningPanel
              bookingId={row.bookingId ?? row.id}
              role="guest"
              screening={row}
              quote={quote}
              consentText={consentText}
              onChanged={() => void load()}
            />
          </div>
        ))}
        {cases.length === 0 && !err && (
          <p className="text-sm text-[#888]">{t("Nadie te ha pedido un screening todavía.")}</p>
        )}
      </div>
    </div>
  );
}
