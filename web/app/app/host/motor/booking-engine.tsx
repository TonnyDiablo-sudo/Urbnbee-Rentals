"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CountryPicker, PhoneBox, VerifyEmailBox, regionForCountry, type BillingCountry } from "@/components/account/purchase-prereqs";
import { useT } from "@/components/i18n-provider";
import { WebLink } from "../../_components/site-origin";
import { PlanPicker, startIdentity, startMembershipCheckout, type CatalogPlan } from "../../_components/plan-picker";

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
  billingCountry: BillingCountry | null;
  emailVerified: boolean;
  hasPhone: boolean;
  /** Anuncios con motor a los que les falta el comprobante de dirección aprobado. */
  addressMissing: number;
  hostCurrentPeriodEnd?: string;
  enginePlansByRegion: { mx: CatalogPlan[]; us: CatalogPlan[] };
  catalogPlansByRegion?: { mx: CatalogPlan[]; us: CatalogPlan[] };
};

const RETURN = "/host/motor";

export function BookingEngine() {
  const t = useT();
  const params = useSearchParams();
  const justPaid = params.get("subscription") === "success";
  const [data, setData] = useState<Status | null>(null);
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
    const e = await startIdentity("/api/host/verification/identity/start", RETURN);
    setBusy(false);
    if (e) setErr(e);
  };

  if (!data) return <p className="px-5 py-6 text-sm text-[#999]">{err ? t(err) : t("Cargando…")}</p>;

  const plans = data.enginePlansByRegion[region];
  const identityPlans = data.catalogPlansByRegion?.[region] ?? [];
  const prereqsOk = Boolean(data.billingCountry) && data.emailVerified && data.hasPhone;
  const engineOn = data.membershipActive;
  const until = data.hostCurrentPeriodEnd
    ? new Date(data.hostCurrentPeriodEnd).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : null;

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
            ? t("Los huéspedes se identifican, pagan y firman contrato en Cabibee.")
            : t("Publicar y chatear es gratis. Para recibir reservas necesitas tu Stripe, tu identidad verificada y el motor de reservas.")}
        </p>
      </div>

      <Step n={1} title={t("Conecta tu Stripe")} done={false} hint={t("Gratis. Conectarlo no activa el motor de reservas.")}>
        <StripeCard engineOn={engineOn} />
      </Step>

      {!prereqsOk && (
        <div className="space-y-3">
          <CountryPicker value={data.billingCountry} onSaved={() => void load()} />
          {!data.emailVerified && <VerifyEmailBox />}
          {!data.hasPhone && <PhoneBox onSaved={() => void load()} />}
        </div>
      )}

      <Step
        n={2}
        title={t("Tu verificación de identidad")}
        done={data.identityPlanActive && data.identityVerified}
        hint={
          data.identityVerified && data.identityPlanActive
            ? t("Comprobada")
            : data.kycStatus === "pending"
              ? t("En revisión")
              : t("Obligatoria para usar el motor. Se contrata aparte.")
        }
      >
        {!data.identityPlanActive && (
          <div className="space-y-3">
            <p className="text-sm text-[#555]">
              {t("Te identificas con una identificación oficial y una selfie, y se compara contra datos oficiales. Así el huésped sabe que eres quien dices ser.")}
            </p>
            {identityPlans.length > 0 ? (
              <PlanPicker plans={identityPlans} busy={busy || !prereqsOk} onPick={(c) => void buy(c)} demo={!data.stripeConfigured} />
            ) : (
              <Link href="/tienda" className="block rounded-xl border border-[#222] py-3 text-center text-sm font-semibold text-[#222]">
                {t("Contratar en la Tienda")}
              </Link>
            )}
          </div>
        )}
        {!data.identityVerified &&
          (data.identityPlanActive ? (
            data.identityEnabled && data.stripeConfigured ? (
              <div className="space-y-2">
                <p className="text-sm text-[#555]">
                  {region === "us"
                    ? t("Ten a la mano tu licencia de manejo, State ID o pasaporte. Te tomarás una selfie. Lo revisa Stripe Identity; Cabibee no guarda las fotos.")
                    : t("Ten a la mano tu INE o pasaporte. Te tomarás una selfie. Lo revisa Stripe Identity; Cabibee no guarda las fotos.")}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void verify()}
                  className="w-full rounded-xl border border-[#222] py-3.5 text-[15px] font-semibold text-[#222] disabled:opacity-60"
                >
                  {data.kycStatus === "pending" ? t("Continuar verificación de identidad") : t("Verificar mi identidad")}
                </button>
              </div>
            ) : (
              <p className="text-sm text-[#555]">{t("La verificación de identidad no está disponible ahorita.")}</p>
            )
          ) : null)}
      </Step>

      <Step
        n={3}
        title={t("Motor de reservas")}
        done={engineOn}
        hint={engineOn ? (until ? t("Activo hasta el {d}", { d: until }) : t("Activo")) : t("Se paga por anuncio.")}
      >
        {engineOn ? (
          <p className="text-sm text-[#555]">{t("Elige abajo qué anuncios lo usan. Para más anuncios, súbele la cantidad en la Tienda.")}</p>
        ) : (
          <div className="space-y-3">
            <ul className="list-disc space-y-1 pl-5 text-sm text-[#484848]">
              <li>{t("El huésped se identifica con identificación oficial y selfie antes de reservar.")}</li>
              <li>{t("Paga con tarjeta en tu Stripe y la reserva se confirma sola.")}</li>
              <li>{t("Se genera el contrato y lo firman en línea.")}</li>
              <li>{t("Requiere tu verificación de identidad (paso 2). La verificación de dirección de cada anuncio viene incluida.")}</li>
              <li>{t("Tú y tu huésped se califican al terminar la estancia; nuestro equipo revisa las reseñas.")}</li>
            </ul>
            {plans.length > 0 ? (
              <PlanPicker
                plans={plans}
                busy={busy || !prereqsOk || !data.identityPlanActive}
                onPick={(c) => void buy(c)}
                demo={!data.stripeConfigured}
              />
            ) : (
              <p className="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm text-[#555]">{t("Todavía no hay planes del motor de reservas a la venta.")}</p>
            )}
            {!data.identityPlanActive && <p className="text-xs text-[#a15c00]">{t("Primero contrata el paso 2.")}</p>}
          </div>
        )}
      </Step>

      <Step
        n={4}
        title={t("Verificación de dirección")}
        done={engineOn && data.addressMissing === 0}
        hint={
          !engineOn
            ? t("Incluida en el motor de reservas.")
            : data.addressMissing > 0
              ? t("Falta en {n} anuncios", { n: data.addressMissing })
              : t("Lista")
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[#555]">
            {t("Sube un recibo a tu nombre con la dirección del anuncio (luz, agua, internet, predial, renta…) y lo revisamos. Tu anuncio muestra el listón «Ubicación verificada», que le da más seguridad y confianza a quien reserva. Sin él sí recibes reservas, sólo no aparece el listón.")}
          </p>
          {engineOn && data.addressMissing > 0 && (
            <a href="#direccion" className="block rounded-xl bg-[#dcb81e] py-3 text-center text-sm font-semibold text-black">
              {t("Subir comprobantes")}
            </a>
          )}
        </div>
      </Step>

      <Link
        href="/tienda"
        className="flex items-center justify-between rounded-2xl border border-[#ebebeb] px-4 py-3 text-[15px] font-semibold text-[#222]"
      >
        <span>
          {t("Ver más productos en la Tienda")}
          <span className="block text-sm font-normal text-[#717171]">{t("Limpieza, colaboradores, anuncio destacado…")}</span>
        </span>
        <span aria-hidden>›</span>
      </Link>

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

function Step({
  n,
  title,
  done,
  hint,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-start gap-3">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            done ? "bg-[#1e7a3a] text-white" : "bg-[#222] text-white"
          }`}
        >
          {done ? "✓" : n}
        </span>
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-[#222]">{title}</h2>
          {hint && <p className="text-sm text-[#717171]">{hint}</p>}
        </div>
      </div>
      {children && <div className="pl-10">{children}</div>}
    </section>
  );
}

type StripeState = {
  connected: boolean;
  account: { chargesEnabled: boolean; livemode: boolean; name: string | null; email: string | null } | null;
};

function StripeCard({ engineOn }: { engineOn: boolean }) {
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
          <span className="block text-emerald-800/80">
            {engineOn
              ? t("Las estancias se cobran en tu cuenta.")
              : t("Listo. Para que tus anuncios reciban reservas faltan tu identidad y el motor de reservas (pasos 2 y 3).")}
          </span>
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
          : t("Si no tienes cuenta, te ayudamos a crearla en unos minutos. Conectarla es gratis; Cabibee nunca cobra la estancia.")}
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
