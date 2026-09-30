"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale } from "@/lib/i18n";

type Status = {
  connected: boolean;
  secretLast4: string | null;
  lastVerifiedAt: string | null;
  lastError: string | null;
  webhookUrl: string;
  cryptoReady: boolean;
};

export function HostPagosClient() {
  const t = useT();
  const lang = useLang();
  const [status, setStatus] = useState<Status | null>(null);
  const [secret, setSecret] = useState("");
  const [whsec, setWhsec] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/host/settings/payments", { credentials: "include" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(typeof j.error === "string" ? j.error : "No se pudo cargar.");
      return;
    }
    setStatus(j as Status);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch("/api/host/settings/payments", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stripeSecretKey: secret, webhookSecret: whsec }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "No se pudo guardar.");
        return;
      }
      setStatus(j as Status);
      setSecret("");
      setWhsec("");
      setOk("Stripe conectado. Las estancias se cobran en tu cuenta.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm(t("¿Dejar de cobrar en tu Stripe? Las reservas nuevas volverán a la cuenta de Cabibee hasta que conectes otra vez."))) {
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#484848]">{t("Pagos de la estancia")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#666]">
          {t("El huésped te paga a ti, no a Cabibee. Pega la secret key de")} <strong>{t("tu")}</strong>{" "}
          {t(
            "cuenta Stripe y el signing secret de un webhook que apunte a la URL de abajo. Cabibee guarda eso cifrado y nunca lo vuelve a mostrar."
          )}
        </p>
      </div>

      {!status?.cryptoReady && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {t("Falta la llave del servidor")} <code className="font-mono">HOST_PAYMENT_CREDS_KEY</code>.{" "}
          {t("Puedes llenar el formulario; el guardado fallará hasta que el fundador la ponga en Railway.")}
        </p>
      )}

      {status?.connected ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-6 text-sm text-emerald-950">
          <p className="font-semibold">{t("Stripe conectado")}</p>
          <p className="mt-1">
            {t("Llave …{last4}", { last4: status.secretLast4 ?? "" })}
            {status.lastVerifiedAt && (
              <span>
                {" "}
                · {t("verificada {date}", {
                  date: new Date(status.lastVerifiedAt).toLocaleString(numberLocale(lang)),
                })}
              </span>
            )}
          </p>
          {status.lastError && <p className="mt-2 text-red-800">{status.lastError}</p>}
          <button
            type="button"
            onClick={() => void disconnect()}
            disabled={busy}
            className="mt-4 text-sm font-medium text-emerald-900 underline disabled:opacity-50"
          >
            {t("Desconectar")}
          </button>
        </section>
      ) : (
        <p className="rounded-lg border border-[#ebebeb] bg-[#fafafa] px-4 py-3 text-sm text-[#555]">
          {t("Mientras no conectes, las reservas se cobran en la cuenta de Cabibee (como hoy).")}
        </p>
      )}

      <section className="rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#484848]">{t("Webhook en tu Dashboard de Stripe")}</h2>
        <p className="mt-2 text-sm text-[#666]">
          {t("Eventos:")} <code className="font-mono text-xs">checkout.session.completed</code> {t("y")}{" "}
          <code className="font-mono text-xs">checkout.session.async_payment_succeeded</code>.
        </p>
        <p className="mt-3 break-all rounded-lg bg-[#111] px-3 py-2 font-mono text-xs text-[#dcb81e]">
          {status?.webhookUrl ?? "…"}
        </p>
      </section>

      <section className="rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#484848]">
          {status?.connected ? t("Reemplazar llaves") : t("Conectar Stripe")}
        </h2>
        <label className="mt-4 block text-sm font-medium text-[#484848]">
          Secret key
          <input
            type="password"
            autoComplete="off"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={t("sk_live_… o rk_…")}
            className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-[#484848]">
          Webhook signing secret
          <input
            type="password"
            autoComplete="off"
            value={whsec}
            onChange={(e) => setWhsec(e.target.value)}
            placeholder="whsec_…"
            className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 font-mono text-sm"
          />
        </label>
        {err && <p className="mt-3 text-sm text-red-700">{t(err)}</p>}
        {ok && <p className="mt-3 text-sm text-emerald-800">{t(ok)}</p>}
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !secret || !whsec}
          className="mt-4 rounded-lg bg-[#111] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? t("Guardando…") : t("Guardar y verificar")}
        </button>
      </section>
    </div>
  );
}
