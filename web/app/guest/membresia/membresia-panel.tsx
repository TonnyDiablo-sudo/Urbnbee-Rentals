"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CountryPicker, PhoneBox, VerifyEmailBox, regionForCountry, type BillingCountry } from "@/components/account/purchase-prereqs";
import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale, type TFn } from "@/lib/i18n";
import type { VerificationRegion } from "@/lib/verification-types";

type PlansPair = { monthly: boolean; annual: boolean };

type CatalogBilling = { kind: "one_time" } | { kind: "subscription"; intervalCount: number };

type CatalogPlan = {
  code: string;
  label: string;
  description: string;
  amount: number;
  currency: "mxn" | "usd";
  billing: CatalogBilling;
};

type StatusPayload = {
  configured: boolean;
  eligible: boolean;
  identityEnabled: boolean;
  regionalPricing: boolean;
  billingRegion: VerificationRegion;
  billingCountry: BillingCountry | null;
  emailVerified: boolean;
  hasPhone: boolean;
  plansAvailable: PlansPair;
  plansByRegion: { mx: PlansPair; us: PlansPair };
  catalogPlansByRegion: { mx: CatalogPlan[]; us: CatalogPlan[] };
  bookingPassesRemaining: number;
  subscriptionStatus: string;
  currentPeriodEnd?: string;
  kycStatus: string;
  hasBillingCustomer: boolean;
};

function formatAmount(plan: CatalogPlan, locale: string): string {
  const currency = plan.currency === "usd" ? "USD" : "MXN";
  return `$${plan.amount.toLocaleString(locale, { maximumFractionDigits: 0 })} ${currency}`;
}

function billingCaption(plan: CatalogPlan, t: TFn, locale: string): string {
  if (plan.billing.kind === "one_time") return t("un solo pago, una reserva");
  const meses = plan.billing.intervalCount;
  const perMonth = plan.amount / meses;
  return t("cada {n} meses · ≈ ${amount} por mes", {
    n: meses,
    amount: perMonth.toLocaleString(locale, { maximumFractionDigits: 0 }),
  });
}

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

/** Hay algo que vender en esa región, sea del catálogo o de los precios viejos. */
function regionSells(payload: StatusPayload, region: VerificationRegion): boolean {
  return (
    payload.catalogPlansByRegion[region].length > 0 ||
    regionHasAnyPlan(payload.plansByRegion[region])
  );
}

export function MembresiaPanel() {
  const t = useT();
  const locale = numberLocale(useLang());
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
        const mx = regionSells(payload, "mx");
        const us = regionSells(payload, "us");
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

  const startCheckout = async (plan: string) => {
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
      const rawText = await res.text();
      let parsed: { error?: string; checkoutUrl?: string; simulated?: boolean } = {};
      try {
        parsed = rawText
          ? (JSON.parse(rawText) as { error?: string; checkoutUrl?: string; simulated?: boolean })
          : {};
      } catch {
        /* server returned non-JSON */
      }
      if (!res.ok) {
        if (typeof parsed.error === "string") {
          setErr(parsed.error);
        } else {
          const snippet = rawText.trim().slice(0, 240) || t("(respuesta vacía)");
          setErr(
            t("No se pudo iniciar (HTTP {status}). Servidor: {snippet}", { status: res.status, snippet })
          );
        }
        return;
      }
      if (parsed.simulated) {
        await load();
        return;
      }
      if (typeof parsed.checkoutUrl === "string" && parsed.checkoutUrl.startsWith("http")) {
        window.location.assign(parsed.checkoutUrl);
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
  const hasPass = (data?.bookingPassesRemaining ?? 0) > 0;
  const needsIdentity = Boolean(
    data?.identityEnabled && (subActive || hasPass) && data?.kycStatus !== "verified"
  );

  const showRegionToggle = Boolean(
    data && regionSells(data, "mx") && regionSells(data, "us")
  );

  const plans = data?.plansByRegion[selectedRegion] ?? { monthly: false, annual: false };
  const catalogPlans = data?.catalogPlansByRegion[selectedRegion] ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-[#222]">{t("Membresía de verificación")}</h1>
      <p className="mt-2 text-sm leading-relaxed text-[#484848]">
        {t("Para solicitar reservas a través de Cabibee necesitas una membresía activa, o un pase por reserva, y —cuando esté activado en el sitio— completar la verificación de identidad con documento oficial y selfie (Stripe Identity).")}
      </p>

      {justPaid && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          {t("Pago recibido. Si el estado no se actualiza en segundos, recarga la página (el webhook puede tardar un poco).")}
        </p>
      )}

      {identityReturn && (
        <p className="mt-4 rounded-lg border border-[#ebebeb] bg-white px-4 py-3 text-sm text-[#484848]">
          {t("Si terminaste el flujo en Stripe, espera unos segundos y pulsa «Actualizar estado». Stripe notificará cuando el resultado esté listo.")}
        </p>
      )}

      {err && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {t(err)}
        </p>
      )}

      {!data && !err && <p className="mt-6 text-sm text-[#888]">{t("Cargando…")}</p>}

      {data && (
        <>
          {!subActive && (
            <div className="mt-6 space-y-3">
              <CountryPicker
                value={data.billingCountry}
                onSaved={(c) => {
                  setSelectedRegion(regionForCountry(c));
                  void load();
                }}
              />
              {!data.emailVerified && <VerifyEmailBox />}
              {!data.hasPhone && <PhoneBox onSaved={() => void load()} />}
              <p className="text-sm text-[#484848]">
                {t("Te identificas con tu identificación oficial y una selfie.")}
              </p>
            </div>
          )}

          {!showRegionToggle && data.regionalPricing && (
            <p className="mt-4 text-xs text-[#888]">
              {t("Precios en {currency} según configuración del servidor.", {
                currency: selectedRegion === "us" ? t("USD (USA)") : t("MXN (México)"),
              })}
            </p>
          )}

          {data.bookingPassesRemaining > 0 && (
            <p className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
              {data.bookingPassesRemaining === 1
                ? t("Tienes {n} pase por reserva sin usar.", { n: data.bookingPassesRemaining })
                : t("Tienes {n} pases por reserva sin usar.", { n: data.bookingPassesRemaining })}{" "}
              {t("Cada pase habilita una reserva, y si el anfitrión la rechaza te lo devolvemos.")}
            </p>
          )}

          {catalogPlans.length > 0 && (
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {catalogPlans.map((p) => (
                <div
                  key={p.code}
                  className="flex flex-col rounded-xl border border-[#ebebeb] bg-white p-5 shadow-sm"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-[#aaa]">{t(p.label)}</p>
                  <p className="mt-3 text-2xl font-semibold text-[#222]">{formatAmount(p, locale)}</p>
                  <p className="mt-1 text-xs text-[#888]">{billingCaption(p, t, locale)}</p>
                  {p.description && (
                    <p className="mt-3 text-sm leading-relaxed text-[#484848]">{t(p.description)}</p>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void startCheckout(p.code)}
                    className="mt-5 w-full rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {p.billing.kind === "one_time" ? t("Comprar pase") : t("Contratar")}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {catalogPlans.length === 0 && plans.monthly && (
              <div className="rounded-xl border border-[#ebebeb] bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-[#aaa]">{t("Plan mensual")}</p>
                <p className="mt-2 text-sm text-[#484848]">{t("Renovación cada mes. Cancela cuando quieras desde Stripe.")}</p>
                <button
                  type="button"
                  disabled={busy || !data.configured}
                  onClick={() => void startCheckout("monthly")}
                  className="mt-4 w-full rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#222] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("Suscribirse mensual")}
                </button>
              </div>
            )}
            {catalogPlans.length === 0 && plans.annual && (
              <div className="rounded-xl border border-[#dcb81e]/40 bg-amber-50/50 p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-900">{t("Plan anual")}</p>
                <p className="mt-2 text-sm text-[#484848]">{t("Un pago al año; suele salir más conveniente que 12 meses sueltos.")}</p>
                <button
                  type="button"
                  disabled={busy || !data.configured}
                  onClick={() => void startCheckout("annual")}
                  className="mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: "#dcb81e" }}
                >
                  {t("Suscribirse anual")}
                </button>
              </div>
            )}
          </div>

          {catalogPlans.length === 0 && !plans.monthly && !plans.annual && (
            <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t("Todavía no hay planes con precio para esta región. El equipo los define en el panel de administración, en «Precios».")}
            </p>
          )}

          <div className="mt-8 rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
            {!data.configured && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {t("Sin price IDs de membresía: en desarrollo no se bloquean reservas por verificación.")}
              </p>
            )}

            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-[#f0f0f0] pb-3">
                <dt className="text-[#717171]">{t("Estado membresía")}</dt>
                <dd className="font-medium text-[#222]">
                  {statusLabel[data.subscriptionStatus] ? t(statusLabel[data.subscriptionStatus]) : data.subscriptionStatus}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-[#f0f0f0] pb-3">
                <dt className="text-[#717171]">{t("Puede reservar en el sitio")}</dt>
                <dd className="font-medium text-[#222]">{data.eligible ? t("Sí") : t("No")}</dd>
              </div>
              {data.currentPeriodEnd && (
                <div className="flex justify-between gap-4 border-b border-[#f0f0f0] pb-3">
                  <dt className="text-[#717171]">{t("Fin de período actual")}</dt>
                  <dd className="font-medium text-[#222]">{new Date(data.currentPeriodEnd).toLocaleString(locale)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-b border-[#f0f0f0] pb-3">
                <dt className="text-[#717171]">{t("Identidad (KYC)")}</dt>
                <dd className="font-medium text-[#222]">
                  {data.identityEnabled
                    ? kycLabel[data.kycStatus]
                      ? t(kycLabel[data.kycStatus])
                      : data.kycStatus
                    : t("No exigida (servidor)")}
                </dd>
              </div>
            </dl>

            {needsIdentity && (
              <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3">
                <p className="text-sm font-medium text-amber-950">{t("Falta verificar tu identidad")}</p>
                <p className="mt-1 text-xs text-amber-900/90">
                  {t("Identificación oficial y selfie. Lo procesa Stripe Identity.")}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void startIdentity()}
                  className="mt-3 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-[#222] disabled:opacity-50"
                >
                  {busy ? t("Abriendo…") : t("Verificar identidad")}
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
                {t("Facturación y cancelación (Stripe)")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void load()}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#717171] underline-offset-2 hover:underline"
              >
                {t("Actualizar estado")}
              </button>
            </div>

            <p className="mt-6 text-xs leading-relaxed text-[#b0b0b0]">
              {t("Cargo por reserva: porcentaje configurable en el servidor sobre el total de estancia; se cobra en el mismo Checkout que el alojamiento cuando aceptes y pagues.")}
            </p>
          </div>
        </>
      )}

      <p className="mt-8 text-sm">
        <Link href="/guest" className="font-medium text-[#dcb81e] underline">
          {t("← Volver al resumen")}
        </Link>
        {" · "}
        <Link href="/membresia" className="font-medium text-[#dcb81e] underline">
          {t("Qué incluye la membresía")}
        </Link>
      </p>
    </div>
  );
}
