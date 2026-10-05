"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { WebLink } from "../../_components/site-origin";
import {
  PlanPicker,
  RegionToggle,
  startIdentity,
  startMembershipCheckout,
  type CatalogPlan,
} from "../../_components/plan-picker";

type Status = {
  acceptsBookings: boolean;
  identityVerified: boolean;
  membershipActive: boolean;
  identityPlanActive: boolean;
  ribbon: boolean;
  kycStatus: string;
  identityEnabled: boolean;
  stripeConfigured: boolean;
  billingRegion: "mx" | "us";
  hostCurrentPeriodEnd?: string;
  catalogPlansByRegion: { mx: CatalogPlan[]; us: CatalogPlan[] };
};

const RETURN = "/host/motor";

export function BookingEngine() {
  const t = useT();
  const params = useSearchParams();
  const justPaid = params.get("subscription") === "success";
  const [data, setData] = useState<Status | null>(null);
  const [region, setRegion] = useState<"mx" | "us">("mx");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/host/verification/status", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "No se pudo cargar.");
        return;
      }
      setData(j);
      setRegion(j.billingRegion === "us" ? "us" : "mx");
    } catch {
      setErr("Sin conexión.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
    const e = await startIdentity("/api/host/verification/identity/start", RETURN);
    setBusy(false);
    if (e) setErr(e);
  };

  if (!data) return <p className="px-5 py-6 text-sm text-[#999]">{err ? t(err) : t("Cargando…")}</p>;

  const plans = data.catalogPlansByRegion[region];
  const bothRegions = data.catalogPlansByRegion.mx.length > 0 && data.catalogPlansByRegion.us.length > 0;

  return (
    <div className="space-y-6 px-5 py-5">
      {justPaid && (
        <p className="rounded-2xl bg-[#e6f6ea] px-4 py-3 text-sm text-[#1e7a3a]">
          {t("Pago recibido. Puede tardar unos segundos en activarse.")}
        </p>
      )}
      {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(err)}</p>}

      <div className={`rounded-2xl p-5 ${data.acceptsBookings ? "bg-[#111] text-white" : "bg-[#fdf6d8] text-[#5c4a0a]"}`}>
        <p className="text-lg font-bold">
          {data.acceptsBookings ? t("Tus anuncios reciben reservas") : t("Tus anuncios sólo reciben mensajes")}
        </p>
        <p className={`mt-1 text-sm leading-relaxed ${data.acceptsBookings ? "text-white/75" : ""}`}>
          {data.acceptsBookings
            ? t("Los huéspedes verificados pueden elegir fechas, pagar y firmar contrato en Cabibee.")
            : t("Publicar y chatear es gratis. Con el motor de reservas los huéspedes reservan y pagan dentro de Cabibee, con contrato.")}
        </p>
      </div>

      <dl className="divide-y divide-[#f0f0f0] rounded-2xl border border-[#ebebeb] text-[15px]">
        <Row label={t("Verificación de identidad")} value={data.identityPlanActive ? t("Activa") : t("Sin contratar")} />
        <Row
          label={t("Identidad")}
          value={data.identityVerified ? t("Comprobada") : data.kycStatus === "pending" ? t("En revisión") : t("Sin comprobar")}
        />
        <Row label={t("Listón «Miembro verificado»")} value={data.ribbon ? t("Sí") : t("No")} />
      </dl>

      <StripeCard />


      {!data.identityVerified && data.identityEnabled && data.stripeConfigured && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void verify()}
          className="w-full rounded-xl border border-[#222] py-3.5 text-[15px] font-semibold text-[#222] disabled:opacity-60"
        >
          {data.kycStatus === "pending" ? t("Continuar verificación de identidad") : t("Verificar mi identidad")}
        </button>
      )}

      {!data.identityPlanActive && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[#222]">{t("Verificación de identidad")}</h2>
            {bothRegions && <RegionToggle value={region} onChange={setRegion} />}
          </div>
          {plans.length > 0 ? (
            <PlanPicker plans={plans} busy={busy} onPick={(c) => void buy(c)} demo={!data.stripeConfigured} />
          ) : (
            <p className="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm text-[#555]">
              {t("Todavía no hay planes de verificación de identidad a la venta.")}
            </p>
          )}
        </section>
      )}

      <WebLink
        path="/host/verificacion"
        icon
        className="flex items-center justify-center gap-1.5 text-sm font-medium text-[#717171] underline"
      >
        {t("Detalle de la verificación en la web")}{" "}
      </WebLink>
    </div>
  );
}

type StripeState = {
  connected: boolean;
  account: { chargesEnabled: boolean; livemode: boolean; name: string | null; email: string | null } | null;
};

function StripeCard() {
  const t = useT();
  const [s, setS] = useState<StripeState | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/host/settings/payments", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && j && setS(j as StripeState))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (!s) return null;
  const ready = s.connected && s.account?.chargesEnabled && s.account.livemode;
  if (ready) {
    return (
      <Link href="/host/pagos" className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <span>
          <strong>{t("Stripe conectado")}</strong>
          {s.account?.name || s.account?.email ? ` · ${s.account.name || s.account.email}` : ""}
          <span className="block text-emerald-800/80">{t("Las estancias se cobran en tu cuenta.")}</span>
        </span>
        <span aria-hidden>›</span>
      </Link>
    );
  }
  return (
    <div className="rounded-2xl border border-[#d9d6ff] bg-[#f5f4ff] p-4 text-sm text-[#2a2566]">
      <p className="text-base font-semibold">
        {s.connected ? t("Termina de activar tu Stripe") : t("Cobra la estancia en tu propia cuenta de Stripe")}
      </p>
      <p className="mt-1 leading-relaxed">
        {s.connected
          ? s.account && !s.account.livemode
            ? t("Estás en modo prueba: los huéspedes no pueden pagar con tarjetas reales.")
            : t("Stripe todavía no te deja cobrar. Completa tus datos y tu banco en Stripe.")
          : t("Si no tienes cuenta, te ayudamos a crearla en unos minutos. Hasta que la conectes, tus anuncios no reciben reservas en línea: Cabibee nunca cobra la estancia.")}
      </p>
      <Link
        href="/host/pagos"
        className="mt-3 flex w-full items-center justify-center rounded-xl bg-[#635bff] py-3 text-[15px] font-semibold text-white"
      >
        {s.connected ? t("Revisar mi Stripe") : t("Conectar o crear cuenta de Stripe")}
      </Link>
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
