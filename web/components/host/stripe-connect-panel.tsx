"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale } from "@/lib/i18n";

type Account = {
  name: string | null;
  email: string | null;
  country: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  livemode: boolean;
};

type Status = {
  connected: boolean;
  secretLast4: string | null;
  lastVerifiedAt: string | null;
  lastError: string | null;
  webhookUrl: string;
  webhookAuto: boolean;
  cryptoReady: boolean;
  account: Account | null;
};

const STRIPE_REGISTER = "https://dashboard.stripe.com/register";
const STRIPE_LOGIN = "https://dashboard.stripe.com/login";
const STRIPE_KEYS = "https://dashboard.stripe.com/apikeys";
const STRIPE_ACTIVATE = "https://dashboard.stripe.com/account/onboarding";
const STRIPE_WEBHOOKS = "https://dashboard.stripe.com/webhooks";

const ext = { target: "_blank", rel: "noopener noreferrer" } as const;
const primaryBtn =
  "inline-flex items-center justify-center rounded-xl bg-[#635bff] px-4 py-3 text-[15px] font-semibold text-white hover:bg-[#5249e8]";
const outlineBtn =
  "inline-flex items-center justify-center rounded-xl border border-[#222] px-4 py-3 text-[15px] font-semibold text-[#222] hover:bg-[#f7f7f7]";

export function StripeConnectPanel() {
  const t = useT();
  const lang = useLang();
  const [status, setStatus] = useState<Status | null>(null);
  const [secret, setSecret] = useState("");
  const [whsec, setWhsec] = useState("");
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [engineOn, setEngineOn] = useState<boolean | null>(null);

  const fetchStatus = useCallback(async (refresh = false) => {
    const res = await fetch(`/api/host/settings/payments${refresh ? "?refresh=1" : ""}`, { credentials: "include" });
    const j = await res.json().catch(() => ({}));
    return res.ok ? { status: j as Status } : { error: typeof j.error === "string" ? j.error : "No se pudo cargar." };
  }, []);

  const load = useCallback(
    async (refresh = false) => {
      const r = await fetchStatus(refresh);
      if (r.status) setStatus(r.status);
      else setErr(r.error ?? null);
    },
    [fetchStatus]
  );

  useEffect(() => {
    let alive = true;
    fetchStatus().then((r) => {
      if (!alive) return;
      if (r.status) setStatus(r.status);
      else setErr(r.error ?? null);
    });
    fetch("/api/host/verification/status", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && j && setEngineOn(Boolean(j.membershipActive)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [fetchStatus]);

  async function save() {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch("/api/host/settings/payments", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stripeSecretKey: secret, webhookSecret: manual ? whsec : "" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "No se pudo guardar.");
        if (j.needsManualWebhook) setManual(true);
        return;
      }
      setStatus(j as Status);
      setSecret("");
      setWhsec("");
      setManual(false);
      setOk(
        engineOn
          ? "Stripe conectado. Las estancias se cobran en tu cuenta."
          : "Stripe conectado. Para recibir reservas falta contratar el motor de reservas."
      );
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm(t("¿Dejar de cobrar en tu Stripe? Las reservas nuevas ya no se cobrarán con esa cuenta hasta que conectes otra."))) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/host/settings/payments", { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        setErr("No se pudo desconectar.");
        return;
      }
      setOk("Desconectado.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function recheck() {
    setBusy(true);
    try {
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  if (!status) return <p className="text-sm text-[#999]">{err ? t(err) : t("Cargando…")}</p>;

  const acct = status.account;
  const ready = status.connected && acct?.chargesEnabled && acct.livemode;

  return (
    <div className="space-y-5">
      {!status.cryptoReady && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {t("Falta la llave del servidor")} <code className="font-mono">HOST_PAYMENT_CREDS_KEY</code>.{" "}
          {t("Puedes llenar el formulario; el guardado fallará hasta que el fundador la ponga en Railway.")}
        </p>
      )}

      {status.connected ? (
        <section
          className={`rounded-2xl border p-5 text-sm ${
            ready ? "border-emerald-200 bg-emerald-50/80 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          <p className="text-base font-semibold">
            {ready ? t("Stripe conectado y listo para cobrar") : t("Stripe conectado, falta un paso")}
          </p>
          <p className="mt-1">
            {acct?.name || acct?.email ? <strong>{acct.name || acct.email}</strong> : null}
            {acct?.name || acct?.email ? " · " : ""}
            {t("Llave …{last4}", { last4: status.secretLast4 ?? "" })}
            {status.lastVerifiedAt && (
              <>
                {" "}
                · {t("verificada {date}", { date: new Date(status.lastVerifiedAt).toLocaleString(numberLocale(lang)) })}
              </>
            )}
          </p>
          <ul className="mt-3 space-y-1.5">
            <Check ok={Boolean(acct?.livemode)} label={acct?.livemode ? t("Modo real (cobros de verdad)") : t("Modo prueba: los huéspedes no pueden pagar con tarjetas reales")} />
            <Check ok={Boolean(acct?.chargesEnabled)} label={acct?.chargesEnabled ? t("Stripe te deja cobrar con tarjeta") : t("Stripe todavía no te deja cobrar")} />
            <Check ok={Boolean(acct?.payoutsEnabled)} label={acct?.payoutsEnabled ? t("Depósitos a tu banco activos") : t("Falta tu cuenta de banco para recibir depósitos")} />
            <Check ok label={status.webhookAuto ? t("Webhook creado por Cabibee en tu Stripe") : t("Webhook configurado a mano")} />
          </ul>
          {!acct && <p className="mt-3">{t("No pudimos leer el estado de tu cuenta de Stripe. Revisa que la llave siga activa.")}</p>}
          {acct && !acct.livemode && (
            <p className="mt-3">
              {t("Cuando termines de probar, cambia a la llave real (sk_live_…) en Stripe y pégala aquí abajo.")}
            </p>
          )}
          {acct && (!acct.chargesEnabled || !acct.payoutsEnabled) && (
            <a href={STRIPE_ACTIVATE} {...ext} className={`${primaryBtn} mt-4 w-full sm:w-auto`}>
              {t("Terminar de activar mi cuenta en Stripe")}
            </a>
          )}
          {status.lastError && <p className="mt-2 text-red-800">{status.lastError}</p>}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            <button type="button" onClick={() => void recheck()} disabled={busy} className="font-medium underline disabled:opacity-50">
              {t("Volver a revisar")}
            </button>
            <button type="button" onClick={() => void disconnect()} disabled={busy} className="font-medium underline disabled:opacity-50">
              {t("Desconectar")}
            </button>
          </div>
        </section>
      ) : (
        <p className="rounded-2xl border border-[#ebebeb] bg-[#fafafa] px-4 py-3 text-sm leading-relaxed text-[#555]">
          {t("Los pagos del motor de reservas son sólo en línea, con tarjeta, y caen directo en tu Stripe. Conectarlo es gratis.")}
        </p>
      )}

      {status.connected && engineOn === false && (
        <section className="rounded-2xl border border-[#f0d77a] bg-[#fdf6d8] p-5 text-sm text-[#5c4a0a]">
          <p className="text-base font-semibold">{t("Tu Stripe ya está conectado. Falta el motor de reservas.")}</p>
          <p className="mt-1 leading-relaxed">
            {t("Conectar Stripe es gratis, pero no activa las reservas. Para que tus huéspedes reserven y paguen, contrata el Motor de reservas: se paga por anuncio, por 1, 6 o 12 meses, e incluye tu verificación de identidad.")}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <a href="/tienda#p-booking_engine" className="inline-flex items-center justify-center rounded-xl bg-[#222] px-4 py-3 text-[15px] font-semibold text-white">
              {t("Contratar el motor de reservas")}
            </a>
            <a href="/tienda" className={outlineBtn}>
              {t("Ver más productos en la Tienda")}
            </a>
          </div>
        </section>
      )}

      {!status.connected && (
        <Step n={1} title={t("Crea tu cuenta de Stripe (gratis)")}>
          <p>
            {t("Stripe es quien cobra la tarjeta del huésped y te deposita en tu banco. Abrirla no cuesta; Stripe cobra una comisión por cada pago. Necesitas tu identificación, tu RFC o número fiscal y la cuenta de banco donde quieres recibir.")}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <a href={STRIPE_REGISTER} {...ext} className={primaryBtn}>
              {t("Crear mi cuenta de Stripe")}
            </a>
            <a href={STRIPE_LOGIN} {...ext} className={outlineBtn}>
              {t("Ya tengo cuenta")}
            </a>
          </div>
          <p className="mt-2 text-xs text-[#888]">
            {t("Se abre en una pestaña nueva. Cuando Stripe te pida activar pagos, completa tus datos y tu banco; luego regresa aquí.")}
          </p>
        </Step>
      )}

      <Step n={status.connected ? undefined : 2} title={status.connected ? t("Cambiar de llave") : t("Copia tu secret key")}>
        <p>
          {t("En Stripe entra a Desarrolladores → Claves de API. Junto a «Clave secreta» toca «Revelar» y cópiala. Empieza con sk_live_ (o sk_test_ si sólo quieres probar).")}
        </p>
        <a href={STRIPE_KEYS} {...ext} className={`${outlineBtn} mt-3 w-full sm:w-auto`}>
          {t("Abrir mis llaves en Stripe")}
        </a>
      </Step>

      <Step n={status.connected ? undefined : 3} title={t("Pégala aquí y conecta")}>
        <p>{t("Cabibee comprueba la llave y crea solo el webhook en tu Stripe para saber cuándo te pagan. Se guarda cifrada y nunca se vuelve a mostrar.")}</p>
        <label className="mt-3 block text-sm font-medium text-[#484848]">
          {t("Secret key")}
          <input
            type="password"
            autoComplete="off"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={t("sk_live_… o rk_…")}
            className="mt-1 w-full rounded-xl border border-[#ddd] px-3 py-2.5 font-mono text-sm"
          />
        </label>

        <button
          type="button"
          onClick={() => setManual((v) => !v)}
          className="mt-3 text-xs font-medium text-[#717171] underline"
        >
          {manual ? t("Mejor que Cabibee cree el webhook") : t("Configurar el webhook a mano")}
        </button>
        {manual && (
          <div className="mt-2 rounded-xl bg-[#fafafa] p-3 text-xs text-[#555]">
            <p>
              {t("En Stripe ve a")}{" "}
              <a href={STRIPE_WEBHOOKS} {...ext} className="underline">
                {t("Webhooks")}
              </a>{" "}
              {t("y crea un endpoint con esta URL y los eventos")}{" "}
              <code className="font-mono">checkout.session.completed</code> {t("y")}{" "}
              <code className="font-mono">checkout.session.async_payment_succeeded</code>:
            </p>
            <p className="mt-2 break-all rounded-lg bg-[#111] px-3 py-2 font-mono text-[#dcb81e]">{status.webhookUrl}</p>
            <label className="mt-3 block text-sm font-medium text-[#484848]">
              {t("Clave secreta de firma del webhook")}
              <input
                type="password"
                autoComplete="off"
                value={whsec}
                onChange={(e) => setWhsec(e.target.value)}
                placeholder="whsec_…"
                className="mt-1 w-full rounded-xl border border-[#ddd] px-3 py-2.5 font-mono text-sm"
              />
            </label>
          </div>
        )}

        {err && <p className="mt-3 text-sm text-red-700">{t(err)}</p>}
        {ok && <p className="mt-3 text-sm text-emerald-800">{t(ok)}</p>}
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !secret || (manual && !whsec)}
          className="mt-4 w-full rounded-xl bg-[#111] px-4 py-3 text-[15px] font-semibold text-white disabled:opacity-40 sm:w-auto"
        >
          {busy ? t("Conectando…") : status.connected ? t("Guardar llave nueva") : t("Conectar mi Stripe")}
        </button>
      </Step>
    </div>
  );
}

function Step({ n, title, children }: { n?: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#ebebeb] bg-white p-5 text-sm leading-relaxed text-[#555] shadow-sm">
      <h2 className="flex items-center gap-2.5 text-base font-semibold text-[#222]">
        {n !== undefined && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#dcb81e] text-sm font-bold text-[#111]">
            {n}
          </span>
        )}
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex gap-2">
      <span className={ok ? "text-emerald-700" : "text-amber-700"} aria-hidden>
        {ok ? "✓" : "!"}
      </span>
      <span>{label}</span>
    </li>
  );
}
