"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale } from "@/lib/i18n";
import { IconShield } from "../_components/icons";
import { WebLink } from "../_components/site-origin";
import { CountryPicker, PhoneBox, VerifyEmailBox, regionForCountry, type BillingCountry } from "@/components/account/purchase-prereqs";
import { PlanPicker, startIdentity, startMembershipCheckout, type CatalogPlan } from "../_components/plan-picker";

type Status = {
  configured: boolean;
  eligible: boolean;
  identityEnabled: boolean;
  billingRegion: "mx" | "us";
  billingCountry: BillingCountry | null;
  emailVerified: boolean;
  hasPhone: boolean;
  plansByRegion: { mx: { monthly: boolean; annual: boolean }; us: { monthly: boolean; annual: boolean } };
  catalogPlansByRegion: { mx: CatalogPlan[]; us: CatalogPlan[] };
  bookingPassesRemaining: number;
  subscriptionStatus: string;
  currentPeriodEnd?: string;
  kycStatus: string;
};

const SUB_LABEL: Record<string, string> = {
  none: "Sin membresía",
  active: "Activa",
  trialing: "En prueba",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
  unpaid: "Sin pagar",
};

const KYC_LABEL: Record<string, string> = {
  not_started: "Sin iniciar",
  pending: "En revisión",
  verified: "Verificada",
  failed: "No aprobada",
  expired: "Expirada",
};

const RETURN = "/membresia";

export function GuestMembership() {
  const t = useT();
  const lang = useLang();
  const params = useSearchParams();
  const justPaid = params.get("subscription") === "success";
  const [data, setData] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/verification/status", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "No se pudo cargar tu membresía.");
        return;
      }
      setData(j);
    } catch {
      setErr("Sin conexión.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const region = data?.billingCountry ? regionForCountry(data.billingCountry) : (data?.billingRegion ?? "mx");

  const buy = async (plan: string) => {
    setBusy(true);
    setErr(null);
    const r = await startMembershipCheckout({ plan, region, cancelPath: RETURN, returnPath: RETURN });
    setBusy(false);
    if (r.error) setErr(r.error);
    if (r.reload) await load();
  };

  const verify = async () => {
    setBusy(true);
    setErr(null);
    const e = await startIdentity("/api/verification/identity/start", RETURN);
    setBusy(false);
    if (e) setErr(e);
  };

  if (!data) return <p className="px-5 py-6 text-sm text-[#999]">{t(err ?? "Cargando…")}</p>;

  const subActive = data.subscriptionStatus === "active" || data.subscriptionStatus === "trialing";
  const plans = data.catalogPlansByRegion[region];
  const legacy = data.plansByRegion[region];
  const canPay = Boolean(data.billingCountry) && data.emailVerified && data.hasPhone;
  const needsIdentity = data.identityEnabled && data.kycStatus !== "verified";

  return (
    <div className="space-y-6 px-5 py-5">
      {justPaid && (
        <p className="rounded-2xl bg-[#e6f6ea] px-4 py-3 text-sm text-[#1e7a3a]">
          {t("Pago recibido. Puede tardar unos segundos en reflejarse.")}
        </p>
      )}
      {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(err)}</p>}

      <div className={`rounded-2xl p-5 ${data.eligible ? "bg-[#111] text-white" : "bg-[#fdf6d8] text-[#5c4a0a]"}`}>
        <IconShield className="h-7 w-7" />
        <p className="mt-3 text-lg font-bold">
          {data.eligible ? t("Ya puedes reservar") : t("Todavía no puedes reservar")}
        </p>
        <p className={`mt-1 text-sm ${data.eligible ? "text-white/75" : ""}`}>
          {data.eligible
            ? t("Tu cuenta cumple con lo que piden los anfitriones de Cabibee.")
            : !subActive && data.bookingPassesRemaining === 0
              ? t("Elige una membresía o un pase por reserva.")
              : t("Falta comprobar tu identidad con documento y selfie.")}
        </p>
      </div>

      <dl className="divide-y divide-[#f0f0f0] rounded-2xl border border-[#ebebeb] text-[15px]">
        <Row label={t("Membresía")} value={SUB_LABEL[data.subscriptionStatus] ? t(SUB_LABEL[data.subscriptionStatus]) : data.subscriptionStatus} />
        {data.currentPeriodEnd && subActive && (
          <Row label={t("Vigente hasta")} value={new Date(data.currentPeriodEnd).toLocaleDateString(numberLocale(lang))} />
        )}
        <Row label={t("Pases por reserva")} value={String(data.bookingPassesRemaining)} />
        {data.identityEnabled && <Row label={t("Identidad")} value={KYC_LABEL[data.kycStatus] ? t(KYC_LABEL[data.kycStatus]) : data.kycStatus} />}
      </dl>

      {needsIdentity && (subActive || data.bookingPassesRemaining > 0) && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void verify()}
          className="w-full rounded-xl bg-[#dcb81e] py-3.5 text-[15px] font-semibold text-black disabled:opacity-60"
        >
          {data.kycStatus === "pending" ? t("Continuar verificación de identidad") : t("Verificar mi identidad")}
        </button>
      )}

      {!subActive && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-[#222]">{t("Planes")}</h2>
          <p className="mb-3 text-sm text-[#555]">
            {region === "us"
              ? t("Te identificas con tu licencia de manejo, State ID o pasaporte y una selfie.")
              : t("Te identificas con tu INE o pasaporte y una selfie.")}
          </p>
          <div className="mb-3 space-y-3">
            <CountryPicker value={data.billingCountry} onSaved={() => void load()} />
            {!data.emailVerified && <VerifyEmailBox />}
            {!data.hasPhone && <PhoneBox onSaved={() => void load()} />}
          </div>
          {plans.length > 0 ? (
            <PlanPicker plans={plans} busy={busy || !canPay} onPick={(c) => void buy(c)} />
          ) : legacy.monthly || legacy.annual ? (
            <div className="space-y-3">
              {legacy.monthly && (
                <button type="button" disabled={busy || !canPay} onClick={() => void buy("monthly")} className="w-full rounded-xl bg-[#111] py-3.5 text-sm font-semibold text-white disabled:opacity-50">
                  {t("Membresía mensual")}
                </button>
              )}
              {legacy.annual && (
                <button type="button" disabled={busy || !canPay} onClick={() => void buy("annual")} className="w-full rounded-xl border border-[#222] py-3.5 text-sm font-semibold disabled:opacity-50">
                  {t("Membresía anual")}
                </button>
              )}
            </div>
          ) : (
            <p className="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm text-[#555]">
              {t("Por ahora no hay planes a la venta en esta región.")}
            </p>
          )}
        </section>
      )}

      <WebLink
        path="/guest/membresia"
        icon
        className="flex items-center justify-center gap-1.5 text-sm font-medium text-[#717171] underline"
      >
        {t("Facturación y cancelación en la web")}{" "}
      </WebLink>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-3">
      <dt className="text-[#717171]">{label}</dt>
      <dd className="font-medium text-[#222]">{value}</dd>
    </div>
  );
}
