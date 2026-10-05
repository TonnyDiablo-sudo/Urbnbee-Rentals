"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale, type TFn } from "@/lib/i18n";

type Billing = { kind: "one_time" } | { kind: "subscription"; intervalCount: number };

type PlanRow = {
  code: string;
  sku?: string;
  audience: "guest" | "host";
  label: string;
  description: string;
  amountMxn: number;
  amountUsd: number;
  floorPrice?: number | null;
  sellerSellable?: boolean;
  priceIsProvisional?: boolean;
  updatedFrom?: string | null;
  active: boolean;
  stripeProductId: string | null;
  billing: Billing;
  offeredMx: boolean;
  offeredUs: boolean;
  updatedAt: string;
};

type ScreeningRow = {
  providerCostMxn: number;
  markupMxn: number;
  amountMxn: number;
  providerCostUsd: number;
  markupUsd: number;
  amountUsd: number;
  stripeProductId?: string;
  active: boolean;
  updatedAt: string;
};

type Payload = {
  plans: PlanRow[];
  stripeConfigured: boolean;
  legacyEnvPricesActive: boolean;
  catalogConfigured?: boolean;
  catalogLive?: boolean;
  note: string;
  missingProducts: string[];
  screening?: ScreeningRow;
};

function billingLabel(b: Billing, t: TFn): string {
  if (b.kind === "one_time") return t("Pago único");
  if (b.intervalCount === 12) return t("Suscripción cada 12 meses");
  return t("Suscripción cada {count} meses", { count: b.intervalCount });
}

const UNIT_BY_FAMILY: Record<string, string> = {
  booking_engine: "precio por anuncio (el anfitrión elige cuántos)",
  collaborator_seat: "precio por colaborador",
  cleaning_tool: "precio por anuncio",
  address_proof: "precio por anuncio (aparte del motor)",
  featured_listing: "precio por anuncio destacado",
};
const unitLabel = (code: string): string | undefined => UNIT_BY_FAMILY[code.replace(/_(6|12)$/, "")];

function monthlyEquivalent(amount: number, b: Billing, t: TFn, locale: string): string | null {
  if (b.kind !== "subscription" || amount <= 0) return null;
  const perMonth = amount / b.intervalCount;
  return t("≈ {amount} por mes", { amount: perMonth.toLocaleString(locale, { maximumFractionDigits: 0 }) });
}

export default function AdminPricingPage() {
  const t = useT();
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/admin/pricing", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) {
        setErr(typeof j.error === "string" ? t(j.error) : t("No se pudo cargar el catálogo."));
        return;
      }
      setData(j as Payload);
    } catch {
      setErr(t("Error de red."));
    }
  }, [t]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  const syncProducts = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/admin/pricing", { method: "POST" });
      const j = await res.json();
      if (!res.ok) {
        setSyncMsg(typeof j.error === "string" ? t(j.error) : t("No se pudo sincronizar."));
        return;
      }
      setSyncMsg(
        j.failed > 0
          ? t("{ready} listos, {failed} con error. Revisa los registros del servidor.", { ready: j.ready, failed: j.failed })
          : t("Listo: {ready} productos en Stripe.", { ready: j.ready })
      );
      await load();
    } catch {
      setSyncMsg(t("Error de red."));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("Precios")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          {t(
            "Los precios se deciden aquí y sólo aquí. Stripe guarda el Producto (el nombre del recibo) y cobra el monto que esté escrito en esta página al momento de comprar."
          )}
        </p>
      </div>

      {err && <p className="mb-4 text-sm text-red-600">{err}</p>}


      {data && data.catalogConfigured && data.catalogLive === false && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
          {t("urbnbeeai no respondió. Estás viendo el último caché bueno.")}
        </div>
      )}

      {data && data.catalogConfigured && data.catalogLive && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-900">
          {t("Catálogo de urbnbeeai conectado. Guardar escribe allá; el cobro usa ese monto.")}
        </div>
      )}

      {data && !data.stripeConfigured && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
          {t("Stripe no está configurado en este servidor (falta")} <code>STRIPE_SECRET_KEY</code>
          {t("). Los precios se pueden escribir, pero no se cobra nada.")}
        </div>
      )}

      {data && data.missingProducts.length > 0 && data.stripeConfigured && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
          {t("Faltan productos en Stripe para: {plans}. Sin producto, el plan no se puede cobrar.", {
            plans: data.missingProducts.join(", "),
          })}
        </div>
      )}

      {data && data.legacyEnvPricesActive && (
        <div className="mb-5 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm text-gray-600">
          {t("Siguen activos los precios viejos por variable de entorno")} (<code>STRIPE_PRICE_VERIFICATION_…</code>
          ),{" "}
          {t(
            "que son los planes mensual y anual. Se usan sólo mientras este catálogo no tenga precios. Cuando los planes de aquí estén encendidos, quita esas variables de Railway para no dejar dos precios vivos."
          )}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void syncProducts()}
          disabled={syncing || !data?.stripeConfigured}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {syncing ? t("Sincronizando…") : t("Sincronizar productos en Stripe")}
        </button>
        {syncMsg && <span className="text-sm text-gray-600">{syncMsg}</span>}
      </div>

      {!data && !err && <p className="text-gray-400">{t("Cargando catálogo…")}</p>}

      {data && (
        <>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            {t("Huésped")}
          </h2>
          <div className="mb-8 space-y-4">
            {data.plans
              .filter((p) => p.audience === "guest")
              .map((p) => (
                <PlanCard key={p.code} plan={p} onSaved={() => void load()} />
              ))}
          </div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            {t("Anfitrión — listón, motor de reservas y herramientas")}
          </h2>
          <p className="mb-4 max-w-3xl text-sm text-gray-500">
            {t(
              "Cada producto tiene plazo de 1, 6 y 12 meses. El monto es lo que se cobra por período (6 meses = 6 × el precio mensual de ese plazo). Todo se renueva solo al vencer."
            )}
          </p>
          <div className="mb-8 space-y-4">
            {data.plans
              .filter((p) => p.audience === "host")
              .map((p) => (
                <PlanCard key={p.code} plan={p} onSaved={() => void load()} />
              ))}
          </div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            {t("Screening de huésped")}
          </h2>
          <p className="mb-4 max-w-3xl text-sm text-gray-500">
            {t(
              "Lo que se cobra es el costo del proveedor más el margen de Cabibee. El anfitrión elige si lo paga él o se lo cobra al huésped. El buró real se enchufa después."
            )}
          </p>
          <p className="mb-4 max-w-3xl rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t(
              "Apagado: huéspedes y anfitriones no lo ven hasta que un proveedor nos apruebe (CREDIT_CHECK_ENABLED en lib/feature-flags.ts)."
            )}
          </p>
          {data.screening && (
            <ScreeningCard screening={data.screening} onSaved={() => void load()} />
          )}
        </>
      )}
    </div>
  );
}

function PlanCard({ plan, onSaved }: { plan: PlanRow; onSaved: () => void }) {
  const t = useT();
  const locale = numberLocale(useLang());
  const [label, setLabel] = useState(plan.label);
  const [description, setDescription] = useState(plan.description);
  const [mxn, setMxn] = useState(String(plan.amountMxn || ""));
  const [usd, setUsd] = useState(String(plan.amountUsd || ""));
  const [active, setActive] = useState(plan.active);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgBad, setMsgBad] = useState(false);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/pricing/${plan.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          description,
          amountMxn: mxn,
          amountUsd: usd,
          active,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsgBad(true);
        setMsg(typeof j.error === "string" ? t(j.error) : t("No se pudo guardar."));
        return;
      }
      setMsgBad(false);
      setMsg(
        j.stripeSync && j.stripeSync.ok === false
          ? t("Precio guardado, pero el producto en Stripe falló: {error}", { error: j.stripeSync.error })
          : t("Guardado.")
      );
      onSaved();
    } catch {
      setMsgBad(true);
      setMsg(t("Error de red."));
    } finally {
      setSaving(false);
    }
  };

  const mxnNum = Number(mxn) || 0;
  const usdNum = Number(usd) || 0;
  const unit = unitLabel(plan.code);
  const mxnMonthly = monthlyEquivalent(mxnNum, plan.billing, t, locale);
  const usdMonthly = monthlyEquivalent(usdNum, plan.billing, t, locale);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-gray-400">{plan.sku ?? plan.code}</p>
          <p className="mt-0.5 text-sm font-semibold text-gray-900">
            {billingLabel(plan.billing, t)}
            {unit && <span className="font-normal text-gray-500"> · {t(unit)}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {plan.stripeProductId ? (
            <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-500">
              {plan.stripeProductId}
            </span>
          ) : (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              {t("sin producto en Stripe")}
            </span>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 accent-amber-500"
            />
            {t("Se ofrece")}
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-gray-500">{t("Nombre (lo ve el huésped y Stripe)")}</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">{t("Descripción")}</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-gray-500">{t("Precio México (MXN)")}</span>
          <input
            value={mxn}
            onChange={(e) => setMxn(e.target.value)}
            inputMode="decimal"
            placeholder={t("vacío = no se ofrece")}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {mxnMonthly && (
            <span className="mt-1 block text-[11px] text-gray-400">
              {mxnMonthly} MXN
            </span>
          )}
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">{t("Precio Estados Unidos (USD)")}</span>
          <input
            value={usd}
            onChange={(e) => setUsd(e.target.value)}
            inputMode="decimal"
            placeholder={t("vacío = no se ofrece")}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {usdMonthly && (
            <span className="mt-1 block text-[11px] text-gray-400">
              {usdMonthly} USD
            </span>
          )}
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? t("Guardando…") : t("Guardar")}
        </button>
        {msg && (
          <span className={`text-sm ${msgBad ? "text-red-600" : "text-green-700"}`}>{msg}</span>
        )}
        <span className="text-[11px] text-gray-400">
          {t("Última edición: {date}", { date: new Date(plan.updatedAt).toLocaleString(locale) })}
        </span>
      </div>
    </div>
  );
}

function ScreeningCard({
  screening,
  onSaved,
}: {
  screening: ScreeningRow;
  onSaved: () => void;
}) {
  const t = useT();
  const locale = numberLocale(useLang());
  const [costMxn, setCostMxn] = useState(String(screening.providerCostMxn || ""));
  const [markupMxn, setMarkupMxn] = useState(String(screening.markupMxn || ""));
  const [costUsd, setCostUsd] = useState(String(screening.providerCostUsd || ""));
  const [markupUsd, setMarkupUsd] = useState(String(screening.markupUsd || ""));
  const [active, setActive] = useState(screening.active);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgBad, setMsgBad] = useState(false);

  const totalMxn = (Number(costMxn) || 0) + (Number(markupMxn) || 0);
  const totalUsd = (Number(costUsd) || 0) + (Number(markupUsd) || 0);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/pricing/screening", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerCostMxn: costMxn,
          markupMxn,
          providerCostUsd: costUsd,
          markupUsd,
          active,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsgBad(true);
        setMsg(typeof j.error === "string" ? t(j.error) : t("No se pudo guardar."));
        return;
      }
      setMsgBad(false);
      setMsg(t("Guardado."));
      onSaved();
    } catch {
      setMsgBad(true);
      setMsg(t("Error de red."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-gray-400">guest_screening</p>
          <p className="mt-0.5 text-sm font-semibold text-gray-900">
            {t("Costo del proveedor + margen de Cabibee")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {screening.stripeProductId ? (
            <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-500">
              {screening.stripeProductId}
            </span>
          ) : (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              {t("el producto se crea al primer cobro")}
            </span>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 accent-amber-500"
            />
            {t("Se ofrece")}
          </label>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-gray-500">{t("Costo proveedor México (MXN)")}</span>
          <input
            value={costMxn}
            onChange={(e) => setCostMxn(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">{t("Margen Cabibee México (MXN)")}</span>
          <input
            value={markupMxn}
            onChange={(e) => setMarkupMxn(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">{t("Costo proveedor EE.UU. (USD)")}</span>
          <input
            value={costUsd}
            onChange={(e) => setCostUsd(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">{t("Margen Cabibee EE.UU. (USD)")}</span>
          <input
            value={markupUsd}
            onChange={(e) => setMarkupUsd(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </label>
      </div>
      <p className="mt-3 text-sm text-gray-600">
        {t("Se cobra")}{" "}
        <span className="font-semibold">${totalMxn.toLocaleString(locale)} MXN</span>
        {" · "}
        <span className="font-semibold">${totalUsd.toLocaleString(locale)} USD</span>
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? t("Guardando…") : t("Guardar")}
        </button>
        {msg && (
          <span className={`text-sm ${msgBad ? "text-red-600" : "text-green-700"}`}>{msg}</span>
        )}
        <span className="text-[11px] text-gray-400">
          {t("Última edición: {date}", { date: new Date(screening.updatedAt).toLocaleString(locale) })}
        </span>
      </div>
    </div>
  );
}
