"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

function ConfirmBody() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? "";
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!sessionId.startsWith("cs_")) {
      setErr("Falta una sesión de pago válida.");
      setBusy(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/bookings/verify-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled)
            setErr(typeof data.error === "string" ? data.error : "No se pudo confirmar el pago.");
          return;
        }
        const st = data.booking?.status as string | undefined;
        if (!cancelled) {
          if (st === "CONFIRMED") {
            setMsg("Pago recibido. Tu reserva está confirmada.");
          } else if (st === "PENDING") {
            setMsg(
              "Pago recibido. Tu solicitud está pendiente de validación por el anfitrión; te avisaremos cuando responda."
            );
          } else {
            setMsg("Pago procesado.");
          }
        }
      } catch {
        if (!cancelled) setErr("Error de red.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      {busy && <p className="text-[#888]">Confirmando pago…</p>}
      {err && <p className="text-red-600">{err}</p>}
      {msg && <p className="text-[#484848]">{msg}</p>}
      <Link href="/" className="mt-8 inline-block text-sm text-[#dcb81e] underline">
        Volver al inicio
      </Link>
    </div>
  );
}

export default function BookingConfirmPage() {
  return (
    <>
      <SiteHeader />
      <div style={{ paddingTop: 72 }}>
        <Suspense fallback={<p className="py-16 text-center text-[#888]">Cargando…</p>}>
          <ConfirmBody />
        </Suspense>
      </div>
      <SiteFooter />
    </>
  );
}
