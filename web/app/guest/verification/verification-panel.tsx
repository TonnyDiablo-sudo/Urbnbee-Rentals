"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type StatusPayload = {
  configured: boolean;
  eligible: boolean;
  subscriptionStatus: string;
  currentPeriodEnd?: string;
  kycStatus: string;
  hasBillingCustomer: boolean;
};

const statusLabel: Record<string, string> = {
  none: "Sin suscripción",
  active: "Activa",
  trialing: "Período de prueba",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
  unpaid: "Impago",
};

export function VerificationPanel() {
  const searchParams = useSearchParams();
  const justPaid = searchParams.get("subscription") === "success";

  const [data, setData] = useState<StatusPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/verification/status", { credentials: "include" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "No se pudo cargar el estado.");
        return;
      }
      setData(j as StatusPayload);
    } catch {
      setErr("Error de red.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-[#222]">Verificación de huésped</h1>
      <p className="mt-2 text-sm leading-relaxed text-[#484848]">
        Suscripción mensual cancelable que habilita solicitar reservas cuando la plataforma lo exija. El proveedor de
        identidad (KYC) se conectará después; aquí solo gestionamos la suscripción vía Stripe.
      </p>

      {justPaid && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          Pago recibido. Si el estado no se actualiza en segundos, recarga la página (el webhook puede tardar un poco).
        </p>
      )}

      {err && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {err}
        </p>
      )}

      {!data && !err && <p className="mt-6 text-sm text-[#888]">Cargando…</p>}

      {data && (
        <div className="mt-8 rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
          {!data.configured && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              El servidor no tiene <code className="text-xs">STRIPE_PRICE_VERIFICATION_MONTHLY</code>: no se exige
              verificación para reservar (útil en desarrollo).
            </p>
          )}

          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-[#f0f0f0] pb-3">
              <dt className="text-[#717171]">Estado suscripción</dt>
              <dd className="font-medium text-[#222]">
                {statusLabel[data.subscriptionStatus] ?? data.subscriptionStatus}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[#f0f0f0] pb-3">
              <dt className="text-[#717171]">Puede reservar</dt>
              <dd className="font-medium text-[#222]">{data.eligible ? "Sí" : "No"}</dd>
            </div>
            {data.currentPeriodEnd && (
              <div className="flex justify-between gap-4 border-b border-[#f0f0f0] pb-3">
                <dt className="text-[#717171]">Fin de período actual</dt>
                <dd className="font-medium text-[#222]">
                  {new Date(data.currentPeriodEnd).toLocaleString()}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-[#717171]">KYC (proveedor externo)</dt>
              <dd className="font-medium text-[#222] capitalize">{data.kycStatus.replace(/_/g, " ")}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={busy || !data.configured}
              className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={async () => {
                setBusy(true);
                setErr(null);
                try {
                  const res = await fetch("/api/verification/checkout", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ cancelPath: "/guest/verification" }),
                  });
                  const j = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setErr(typeof j.error === "string" ? j.error : "No se pudo iniciar.");
                    return;
                  }
                  if (typeof j.checkoutUrl === "string" && j.checkoutUrl.startsWith("http")) {
                    window.location.assign(j.checkoutUrl);
                    return;
                  }
                  setErr("Respuesta inválida del servidor.");
                } catch {
                  setErr("Error de red.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Redirigiendo…" : "Suscribirse / renovar"}
            </button>

            <button
              type="button"
              disabled={busy || !data.hasBillingCustomer}
              className="rounded-lg border border-[#ddd] bg-white px-5 py-2.5 text-sm font-semibold text-[#222] transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={async () => {
                setBusy(true);
                setErr(null);
                try {
                  const res = await fetch("/api/verification/billing-portal", {
                    method: "POST",
                    credentials: "include",
                  });
                  const j = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setErr(typeof j.error === "string" ? j.error : "No se pudo abrir el portal.");
                    return;
                  }
                  if (typeof j.portalUrl === "string" && j.portalUrl.startsWith("http")) {
                    window.location.assign(j.portalUrl);
                    return;
                  }
                  setErr("Respuesta inválida del servidor.");
                } catch {
                  setErr("Error de red.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Facturación y cancelación (Stripe)
            </button>

            <button
              type="button"
              disabled={busy}
              className="rounded-lg px-2 py-2.5 text-sm font-medium text-[#717171] underline-offset-2 hover:underline"
              onClick={() => void load()}
            >
              Actualizar estado
            </button>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-[#b0b0b0]">
            Cargo por reserva: porcentaje configurable en el servidor (p. ej. 1%) sobre el total de estancia; se cobra en el
            mismo Checkout que el alojamiento.
          </p>
        </div>
      )}

      <p className="mt-8 text-sm">
        <Link href="/guest" className="font-medium text-[#dcb81e] underline">
          ← Volver al resumen
        </Link>
      </p>
    </div>
  );
}
