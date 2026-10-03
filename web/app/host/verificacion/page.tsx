"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AddressProofPanel } from "@/components/host/address-proof-panel";
import { EngineListingsPanel } from "@/components/host/engine-listings-panel";
import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale, type TFn } from "@/lib/i18n";
import type { VerificationRegion } from "@/lib/verification-types";

type CatalogBilling = { kind: "one_time" } | { kind: "subscription"; intervalCount: number };

type CatalogPlan = {
  code: string;
  label: string;
  description: string;
  amount: number;
  currency: "mxn" | "usd";
  billing: CatalogBilling;
};

type Status = {
  identityVerified: boolean;
  membershipActive: boolean;
  identityPlanActive: boolean;
  ribbon: boolean;
  verifiedAt?: string;
  source?: "identity" | "admin";
  kycStatus: string;
  identityEnabled: boolean;
  hostSubscriptionStatus: string;
  hostCurrentPeriodEnd?: string;
  stripeConfigured: boolean;
  billingRegion: VerificationRegion;
  catalogPlansByRegion: { mx: CatalogPlan[]; us: CatalogPlan[] };
  listingsTotal: number;
  listingsWithBadge: number;
};

const KYC_LABEL: Record<string, string> = {
  not_started: "Sin iniciar",
  pending: "En revisión por Stripe",
  verified: "Aprobada",
  failed: "No aprobada",
  expired: "Expirada",
};

function formatAmount(plan: CatalogPlan): string {
  const currency = plan.currency === "usd" ? "USD" : "MXN";
  return `$${plan.amount.toLocaleString("es-MX", { maximumFractionDigits: 0 })} ${currency}`;
}

function billingCaption(plan: CatalogPlan, t: TFn): string {
  if (plan.billing.kind === "one_time") return t("un solo pago");
  const meses = plan.billing.intervalCount;
  const perMonth = plan.amount / meses;
  return t("cada {n} meses · ≈ ${amount} por mes", {
    n: meses,
    amount: perMonth.toLocaleString("es-MX", { maximumFractionDigits: 0 }),
  });
}

export default function HostVerificacionPage() {
  const t = useT();
  return (
    <Suspense fallback={<p className="text-sm text-[#888]">{t("Cargando…")}</p>}>
      <HostVerificacionClient />
    </Suspense>
  );
}

function HostVerificacionClient() {
  const t = useT();
  const lang = useLang();
  const searchParams = useSearchParams();
  const justReturned = searchParams.get("identity") != null;
  const justPaid = searchParams.get("subscription") === "success";

  const [data, setData] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<VerificationRegion>("mx");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/host/verification/status", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "No se pudo cargar el estado.");
        return;
      }
      const payload = j as Status;
      setData(payload);
      if (payload.billingRegion === "us" || payload.billingRegion === "mx") {
        setSelectedRegion(payload.billingRegion);
      }
    } catch {
      setErr("Error de red.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startIdentity = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/host/verification/identity/start", { method: "POST" });
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
          cancelPath: "/host/verificacion",
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        checkoutUrl?: string;
        simulated?: boolean;
      };
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "No se pudo iniciar el cobro.");
        return;
      }
      if (j.simulated) {
        await load();
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

  const catalogPlans = data?.catalogPlansByRegion[selectedRegion] ?? [];
  const showRegionToggle = Boolean(
    data &&
      data.catalogPlansByRegion.mx.length > 0 &&
      data.catalogPlansByRegion.us.length > 0
  );

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-[#484848]">{t("Miembro verificado")}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#717171]">
        {t(
          "El listón «Miembro verificado» en tus anuncios pide tu identidad comprobada y la verificación de identidad vigente. Es una sola por persona: si ya la tienes como huésped, también cuenta aquí."
        )}
      </p>

      {err && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {t(err)}
        </p>
      )}

      {justPaid && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          {t("Pago recibido. Si el listón no aparece, confirma también tu identidad.")}
        </p>
      )}

      {justReturned && (
        <p className="mt-4 rounded-lg border border-[#ebebeb] bg-white px-4 py-3 text-sm text-[#484848]">
          {t("Si terminaste el proceso en Stripe, espera unos segundos y pulsa «Actualizar estado».")}
        </p>
      )}

      {!data && !err && <p className="mt-6 text-sm text-[#888]">{t("Cargando…")}</p>}

      {data && (
        <>
          <div
            className={`mt-6 rounded-xl border p-5 ${
              data.ribbon ? "border-green-200 bg-green-50" : "border-[#ebebeb] bg-white shadow-sm"
            }`}
          >
            <p className="text-sm font-semibold text-[#222]">
              {data.ribbon
                ? t("Tus anuncios muestran «Miembro verificado»")
                : t("Todavía no tienes el listón")}
            </p>
            <p className="mt-1 text-sm text-[#484848]">
              {data.ribbon
                ? t("{n} de {total} alojamientos lo muestran.", {
                    n: data.listingsWithBadge,
                    total: data.listingsTotal,
                  })
                : t("Falta {items}.", {
                    items: [
                      !data.identityVerified ? t("comprobar tu identidad") : null,
                      !data.identityPlanActive ? t("contratar la verificación de identidad") : null,
                    ]
                      .filter(Boolean)
                      .join(t(" y ")),
                  })}
            </p>
          </div>

          <dl className="mt-6 grid gap-3 rounded-xl border border-[#ebebeb] bg-white p-5 text-sm shadow-sm">
            <div className="flex justify-between gap-4 border-b border-[#f0f0f0] pb-3">
              <dt className="text-[#717171]">{t("Identidad")}</dt>
              <dd className="font-medium text-[#222]">
                {data.identityVerified ? t("Comprobada") : t(KYC_LABEL[data.kycStatus] ?? data.kycStatus)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[#f0f0f0] pb-3">
              <dt className="text-[#717171]">{t("Verificación de identidad")}</dt>
              <dd className="font-medium text-[#222]">
                {data.identityPlanActive ? t("Activa") : t("Sin contratar")}
              </dd>
            </div>
            {data.hostCurrentPeriodEnd && (
              <div className="flex justify-between gap-4">
                <dt className="text-[#717171]">{t("Vence")}</dt>
                <dd className="font-medium text-[#222]">
                  {new Date(data.hostCurrentPeriodEnd).toLocaleDateString(numberLocale(lang))}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-8 space-y-8">
            <EngineListingsPanel />
            <AddressProofPanel surface="web" />
          </div>

          {showRegionToggle && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="text-sm text-[#717171]">{t("Precios:")}</span>
              <div className="inline-flex rounded-lg border border-[#ddd] bg-white p-0.5">
                {(["mx", "us"] as VerificationRegion[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={busy}
                    onClick={() => setSelectedRegion(r)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                      selectedRegion === r ? "bg-black text-white" : "text-[#484848]"
                    }`}
                  >
                    {r === "mx" ? t("México (MXN)") : "USA (USD)"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {catalogPlans.length > 0 && !data.identityPlanActive && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {catalogPlans.map((p) => (
                <div
                  key={p.code}
                  className="flex flex-col rounded-xl border border-[#ebebeb] bg-white p-5 shadow-sm"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-[#aaa]">{p.label}</p>
                  <p className="mt-3 text-2xl font-semibold text-[#222]">{formatAmount(p)}</p>
                  <p className="mt-1 text-xs text-[#888]">{billingCaption(p, t)}</p>
                  {p.description && (
                    <p className="mt-3 text-sm leading-relaxed text-[#484848]">{p.description}</p>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void startCheckout(p.code)}
                    className="mt-5 w-full rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#222] disabled:opacity-50"
                  >
                    {data.stripeConfigured ? t("Contratar") : t("Contratar (demo)")}
                  </button>
                </div>
              ))}
            </div>
          )}

          {catalogPlans.length === 0 && !data.identityPlanActive && (
            <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {t(
                "Todavía no hay planes de verificación de identidad con precio. El equipo los define en Administración → Precios."
              )}
            </p>
          )}

          {!data.identityEnabled && !data.identityVerified && (
            <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {t(
                "La verificación automática está apagada. El equipo puede comprobar tu identidad a mano desde el panel de administración."
              )}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {!data.identityVerified && data.identityEnabled && data.stripeConfigured && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void startIdentity()}
                className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#222] disabled:opacity-50"
              >
                {busy
                  ? t("Abriendo…")
                  : data.kycStatus === "pending"
                    ? t("Continuar verificación")
                    : t("Verificar mi identidad")}
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void load()}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#717171] underline-offset-2 hover:underline"
            >
              {t("Actualizar estado")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
