"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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

  if (!data) return <p className="px-5 py-6 text-sm text-[#999]">{err ?? "Cargando…"}</p>;

  const plans = data.catalogPlansByRegion[region];
  const bothRegions = data.catalogPlansByRegion.mx.length > 0 && data.catalogPlansByRegion.us.length > 0;

  return (
    <div className="space-y-6 px-5 py-5">
      {justPaid && (
        <p className="rounded-2xl bg-[#e6f6ea] px-4 py-3 text-sm text-[#1e7a3a]">
          Pago recibido. Puede tardar unos segundos en activarse.
        </p>
      )}
      {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}

      <div className={`rounded-2xl p-5 ${data.acceptsBookings ? "bg-[#111] text-white" : "bg-[#fdf6d8] text-[#5c4a0a]"}`}>
        <p className="text-lg font-bold">
          {data.acceptsBookings ? "Tus anuncios reciben reservas" : "Tus anuncios sólo reciben mensajes"}
        </p>
        <p className={`mt-1 text-sm leading-relaxed ${data.acceptsBookings ? "text-white/75" : ""}`}>
          {data.acceptsBookings
            ? "Los huéspedes verificados pueden elegir fechas, pagar y firmar contrato en Cabibee."
            : "Publicar y chatear es gratis. Con la membresía de anfitrión los huéspedes reservan y pagan dentro de Cabibee, con contrato."}
        </p>
      </div>

      <dl className="divide-y divide-[#f0f0f0] rounded-2xl border border-[#ebebeb] text-[15px]">
        <Row label="Membresía de anfitrión" value={data.membershipActive ? "Activa" : "Sin contratar"} />
        {data.hostCurrentPeriodEnd && data.membershipActive && (
          <Row label="Vence" value={new Date(data.hostCurrentPeriodEnd).toLocaleDateString("es-MX")} />
        )}
        <Row label="Identidad" value={data.identityVerified ? "Comprobada" : data.kycStatus === "pending" ? "En revisión" : "Sin comprobar"} />
        <Row label="Listón «Miembro verificado»" value={data.ribbon ? "Sí" : "No"} />
      </dl>

      {!data.identityVerified && data.identityEnabled && data.stripeConfigured && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void verify()}
          className="w-full rounded-xl border border-[#222] py-3.5 text-[15px] font-semibold text-[#222] disabled:opacity-60"
        >
          {data.kycStatus === "pending" ? "Continuar verificación de identidad" : "Verificar mi identidad"}
        </button>
      )}

      {!data.membershipActive && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[#222]">Planes de anfitrión</h2>
            {bothRegions && <RegionToggle value={region} onChange={setRegion} />}
          </div>
          {plans.length > 0 ? (
            <PlanPicker plans={plans} busy={busy} onPick={(c) => void buy(c)} demo={!data.stripeConfigured} />
          ) : (
            <p className="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm text-[#555]">
              Todavía no hay planes de anfitrión a la venta. Mientras tanto tus anuncios aceptan reservas sin membresía.
            </p>
          )}
        </section>
      )}

      <WebLink
        path="/host/verificacion"
        icon
        className="flex items-center justify-center gap-1.5 text-sm font-medium text-[#717171] underline"
      >
        Detalle de la membresía en la web{" "}
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
