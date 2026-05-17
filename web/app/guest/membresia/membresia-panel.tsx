"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { VerificationRegion } from "@/lib/verification-types";

type PlansPair = { monthly: boolean; annual: boolean };

type StatusPayload = {
  configured: boolean;
  eligible: boolean;
  identityEnabled: boolean;
  regionalPricing: boolean;
  billingRegion: VerificationRegion;
  plansAvailable: PlansPair;
  plansByRegion: { mx: PlansPair; us: PlansPair };
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

const kycLabel: Record<string, string> = {
  not_started: "Sin iniciar",
  pending: "En revisión",
  verified: "Verificada",
  failed: "No aprobada",
  expired: "Expirada",
};

function regionHasAnyPlan(p: PlansPair): boolean {
  return p.monthly || p.annual;
}

export function MembresiaPanel() {
  const searchParams = useSearchParams();
  const justPaid = searchParams.get("subscription") === "success";
  const identityReturn = searchParams.get("identity") != null;

  const [data, setData] = useState<StatusPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<VerificationRegion>("mx");
  const regionInit = useRef(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/verification/status", { credentials: "include" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "No se pudo cargar el estado.");
        return;
      }
      const payload = j as StatusPayload;
      setData(payload);
      if (!regionInit.current) {
        const mx = regionHasAnyPlan(payload.plansByRegion.mx);
        const us = regionHasAnyPlan(payload.plansByRegion.us);
        if (mx && !us) setSelectedRegion("mx");
        else if (us && !mx) setSelectedRegion("us");
        else if (payload.billingRegion === "mx" || payload.billingRegion === "us") {
          setSelectedRegion(payload.billingRegion);
        }
        regionInit.current = true;
      }
    } catch {
      setErr("Error de red.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startCheckout = async (plan: "monthly" | "annual") => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/verification/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          region: selectedRegion,
          cancelPath: "/guest/membresia",
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; checkoutUrl?: string };
      if (!res.ok) {
        setErr(
          typeof j.error === "string"
            ? j.error
            : `No se pudo iniciar (HTTP ${res.status}). Revisa sesión y variables Stripe en el servidor.`
        );
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
  };

  const startIdentity = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/verification/identity/start", {
        method: "POST",
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "No se pudo iniciar la verificación.");
        return;
      }
      if (typeof j.url === "string" && j.url.startsWith("http")) {
        window.location.assign(j.url);
        return;
      }
      setErr("Respuesta inválida del servidor.");
    } catch {
      setErr("Error de red.");
    } finally {
      setBusy(false);
    }
  };

  const openPortal = async () => {
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
  };

  const subActive =
    data?.subscriptionStatus === "active" || data?.subscriptionStatus === "trialing";
  const needsIdentity =
    Boolean(data?.identityEnabled && data?.configured && subActive && data?.kycStatus !== "verified");

  const showRegionToggle = Boolean(
    data &&
      data.regionalPricing &&
      regionHasAnyPlan(data.plansByRegion.mx) &&
      regionHasAnyPlan(data.plansByRegion.us)
  );

  const plans = data?.plansByRegion[selectedRegion] ?? { monthly: false, annual: false };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-[#222]">Membresía de verificación</h1>
      <p className="mt-2 text-sm leading-relaxed text-[#484848]">
        Para solicitar reservas a través de Urbnbee necesitas una membresía activa (mensual o anual) y, cuando esté
        activado en el sitio, completar la verificación de identidad con documento oficial y selfie (Stripe Identity).
      </p>

      {justPaid && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          Pago recibido. Si el estado no se actualiza en segundos, recarga la página (el webhook puede tardar un poco).
        </p>
      )}

      {identityReturn && (
        <p className="mt-4 rounded-lg border border-[#ebebeb] bg-white px-4 py-3 text-sm text-[#484848]">
          Si terminaste el flujo en Stripe, espera unos segundos y pulsa «Actualizar estado». Stripe notificará cuando el
          resultado esté listo.
        </p>
      )}

      {err && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {err}
        </p>
      )}

      {!data && !err && <p className="mt-6 text-sm text-[#888]">Cargando…</p>}

      {data && (
        <>
          {showRegionToggle && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="text-sm text-[#717171]">Precios:</span>
              <div className="inline-flex rounded-lg border border-[#ddd] bg-white p-0.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setSelectedRegion("mx")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    selectedRegion === "mx"
                      ? "bg-black text-white"
                      : "text-[#484848] hover:bg-[#f5f5f5]"
                  }`}
                >
                  México (MXN)
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setSelectedRegion("us")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    selectedRegion === "us"
                      ? "bg-black text-white"
                      : "text-[#484848] hover:bg-[#f5f5f5]"
                  }`}
                >
                  USA (USD)
                </button>
              </div>
            </div>
          )}

          {!showRegionToggle && data.regionalPricing && (
            <p className="mt-4 text-xs text-[#888]">
              Precios en {selectedRegion === "us" ? "USD (USA)" : "MXN (México)"} según configuración del servidor.
            </p>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {plans.monthly && (
              <div className="rounded-xl border border-[#ebebeb] bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-[#aaa]">Plan mensual</p>
                <p className="mt-2 text-sm text-[#484848]">Renovación cada mes. Cancela cuando quieras desde Stripe.</p>
                <button
                  type="button"
                  disabled={busy || !data.configured}
                  onClick={() => void startCheckout("monthly")}
                  className="mt-4 w-full rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Suscribirse mensual
                </button>
              </div>
            )}
            {plans.annual && (
              <div className="rounded-xl border border-[#dcb81e]/40 bg-amber-50/50 p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-900">Plan anual</p>
                <p className="mt-2 text-sm text-[#484848]">Un pago al año; suele salir más conveniente que 12 meses sueltos.</p>
                <button
                  type="button"
                  disabled={busy || !data.configured}
                  onClick={() => void startCheckout("annual")}
                  className="mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: "#dcb81e" }}
                >
                  Suscribirse anual
                </button>
              </div>
            )}
          </div>

          {!plans.monthly && !plans.annual && (
            <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No hay planes para esta región en el servidor. Configura{" "}
              <code className="text-xs">STRIPE_PRICE_VERIFICATION_MX_MONTHLY</code>,{" "}
              <code className="text-xs">STRIPE_PRICE_VERIFICATION_MX_ANNUAL</code>,{" "}
              <code className="text-xs">STRIPE_PRICE_VERIFICATION_US_MONTHLY</code>,{" "}
              <code className="text-xs">STRIPE_PRICE_VERIFICATION_US_ANNUAL</code> (o las variables legado{" "}
              <code className="text-xs">STRIPE_PRICE_VERIFICATION_MONTHLY</code> /{" "}
              <code className="text-xs">ANNUAL</code>).
            </p>
          )}

          <div className="mt-8 rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
            {!data.configured && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Sin price IDs de membresía: en desarrollo no se bloquean reservas por verificación.
              </p>
            )}

            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-[#f0f0f0] pb-3">
                <dt className="text-[#717171]">Estado membresía</dt>
                <dd className="font-medium text-[#222]">
                  {statusLabel[data.subscriptionStatus] ?? data.subscriptionStatus}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-[#f0f0f0] pb-3">
                <dt className="text-[#717171]">Puede reservar en el sitio</dt>
                <dd className="font-medium text-[#222]">{data.eligible ? "Sí" : "No"}</dd>
              </div>
              {data.currentPeriodEnd && (
                <div className="flex justify-between gap-4 border-b border-[#f0f0f0] pb-3">
                  <dt className="text-[#717171]">Fin de período actual</dt>
                  <dd className="font-medium text-[#222]">{new Date(data.currentPeriodEnd).toLocaleString()}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-b border-[#f0f0f0] pb-3">
                <dt className="text-[#717171]">Identidad (KYC)</dt>
                <dd className="font-medium text-[#222]">
                  {data.identityEnabled ? (kycLabel[data.kycStatus] ?? data.kycStatus) : "No exigida (servidor)"}
                </dd>
              </div>
            </dl>

            {needsIdentity && (
              <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3">
                <p className="text-sm font-medium text-amber-950">Falta verificar tu identidad</p>
                <p className="mt-1 text-xs text-amber-900/90">
                  Documento oficial (INE, licencia o pasaporte) y selfie. Lo procesa Stripe Identity.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void startIdentity()}
                  className="mt-3 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-[#222] disabled:opacity-50"
                >
                  {busy ? "Abriendo…" : "Verificar identidad"}
                </button>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                disabled={busy || !data.hasBillingCustomer}
                onClick={() => void openPortal()}
                className="rounded-lg border border-[#ddd] bg-white px-5 py-2.5 text-sm font-semibold text-[#222] transition hover:bg-[#fafafa] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Facturación y cancelación (Stripe)
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void load()}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#717171] underline-offset-2 hover:underline"
              >
                Actualizar estado
              </button>
            </div>

            <p className="mt-6 text-xs leading-relaxed text-[#b0b0b0]">
              Cargo por reserva: porcentaje configurable en el servidor sobre el total de estancia; se cobra en el mismo
              Checkout que el alojamiento cuando aceptes y pagues.
            </p>
          </div>
        </>
      )}

      <p className="mt-8 text-sm">
        <Link href="/guest" className="font-medium text-[#dcb81e] underline">
          ← Volver al resumen
        </Link>
        {" · "}
        <Link href="/membresia" className="font-medium text-[#dcb81e] underline">
          Qué incluye la membresía
        </Link>
      </p>
    </div>
  );
}
