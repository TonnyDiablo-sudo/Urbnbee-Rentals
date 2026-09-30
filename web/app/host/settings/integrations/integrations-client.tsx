"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale } from "@/lib/i18n";

type Status = {
  linked: boolean;
  beeagentCustomerId: number | null;
  linkedAt: string | null;
  signupUrl: string;
  startUrl: string;
  agentStatus?: { active: boolean; customerAgentId?: string } | null;
};

export function IntegrationsClient() {
  const t = useT();
  const lang = useLang();
  const [status, setStatus] = useState<Status | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [codeExpires, setCodeExpires] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/host/integrations/beeagent", { credentials: "include" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(typeof j.error === "string" ? j.error : "No se pudo cargar el estado.");
      return;
    }
    setStatus(j as Status);
  }, []);

  useEffect(() => {
    void load();
  }, []);

  async function generateCode() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/host/integrations/beeagent/link-code", {
        method: "POST",
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Error al generar código.");
        return;
      }
      setCode(typeof j.code === "string" ? j.code : null);
      setCodeExpires(typeof j.expiresAt === "string" ? j.expiresAt : null);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/host/integrations/beeagent/disconnect", {
        method: "POST",
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "No se pudo desconectar.");
        return;
      }
      setCode(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  const startUrl = status?.startUrl ?? "https://www.urbnbeeai.com/integrations/cabibee/start";
  const signupUrl = status?.signupUrl ?? "https://www.urbnbeeai.com/signup";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#484848]">{t("Integraciones")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#666]">
          {t(
            "Conecta urbnbeeai para que tu agente IA use tus anuncios, fechas y reservas. La contraseña se teclea solo en Cabibee."
          )}
        </p>
      </div>

      <section className="rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#484848]">urbnbeeai</h2>

        {status?.linked ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
            <p className="font-semibold">{t("Cuenta vinculada")}</p>
            <p className="mt-1">
              Workspace #{status.beeagentCustomerId}
              {status.linkedAt && (
                <span className="text-emerald-800/80">
                  {" "}
                  · {t("desde {date}", { date: new Date(status.linkedAt).toLocaleString(numberLocale(lang)) })}
                </span>
              )}
            </p>
            {status.agentStatus && (
              <p className="mt-2 text-sm">
                {t("Agente:")} {status.agentStatus.active ? t("activo") : t("inactivo")}
                {status.agentStatus.customerAgentId
                  ? ` · ${status.agentStatus.customerAgentId}`
                  : ""}
              </p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void disconnect()}
              className="mt-3 text-sm font-semibold text-red-800 underline disabled:opacity-50"
            >
              {t("Desconectar")}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[#666]">{t("Aún no hay vinculación con urbnbeeai.")}</p>
        )}

        {!status?.linked && (
          <div className="mt-6 space-y-3">
            <a
              href={startUrl}
              className="inline-flex rounded-full px-5 py-2.5 text-sm font-semibold text-black"
              style={{ backgroundColor: "#dcb81e" }}
            >
              {t("Activar agente IA con urbnbeeai")}
            </a>
            <p className="text-xs text-[#888]">
              {t("Te manda a urbnbeeai a elegir el agente y te regresa aquí para confirmar.")}
            </p>
            <p className="text-xs text-[#888]">
              {t("¿Sin cuenta?")}{" "}
              <a href={signupUrl} className="underline" target="_blank" rel="noopener noreferrer">
                {t("Regístrate en urbnbeeai")}
              </a>
              .
            </p>
          </div>
        )}

        <div className="mt-8 border-t border-[#eee] pt-6">
          <p className="text-sm font-medium text-[#484848]">{t("Código manual (10 minutos)")}</p>
          <p className="mt-1 text-xs text-[#888]">
            {t("Respaldo si no usas el botón. Pégalo en urbnbeeai → Conectar Cabibee.")}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void generateCode()}
            className="mt-3 rounded-full border border-[#ddd] bg-white px-5 py-2.5 text-sm font-semibold text-[#484848] hover:bg-[#fafafa] disabled:opacity-50"
          >
            {busy ? t("Generando…") : t("Generar código")}
          </button>
          {code && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/70">{t("Tu código")}</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-amber-950">{code}</p>
              {codeExpires && (
                <p className="mt-2 text-xs text-amber-900/80">
                  {t("Expira: {date}", { date: new Date(codeExpires).toLocaleString(numberLocale(lang)) })}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{t(err)}</p>}
    </div>
  );
}
