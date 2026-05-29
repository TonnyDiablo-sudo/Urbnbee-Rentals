"use client";

import { useCallback, useEffect, useState } from "react";

type Status = {
  linked: boolean;
  beeagentCustomerId: number | null;
  linkedAt: string | null;
  signupUrl: string;
};

export function IntegrationsClient() {
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
  }, [load]);

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

  const signupUrl = status?.signupUrl ?? "https://www.urbnbeeai.com/signup";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#484848]">Integraciones</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#666]">
          Conecta tu cuenta de <strong>urbnbeeai.com</strong> (BeeAgent) para que tu agente de IA responda
          por SMS, WhatsApp o Messenger usando los mismos alojamientos que publicas aquí.
        </p>
      </div>

      <section className="rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#484848]">BeeAgent (urbnbeeai.com)</h2>

        {status?.linked ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
            <p className="font-semibold">Cuenta vinculada</p>
            <p className="mt-1">
              Workspace BeeAgent #{status.beeagentCustomerId}
              {status.linkedAt && (
                <span className="text-emerald-800/80">
                  {" "}
                  · desde {new Date(status.linkedAt).toLocaleString("es-MX")}
                </span>
              )}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[#666]">Aún no hay vinculación con BeeAgent.</p>
        )}

        <div className="mt-6 space-y-4 text-sm text-[#484848]">
          <div>
            <p className="font-medium">¿Ya tienes cuenta en urbnbeeai.com?</p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-[#666]">
              <li>Crea un agente con la tool <strong>Host</strong> activada.</li>
              <li>Abre <strong>Conectar urbnbee.net</strong>.</li>
              <li>
                Si tu email coincide con esta cuenta, elige <strong>Vincular con mi email</strong> (Camino
                automático).
              </li>
              <li>
                Si no, genera un código abajo y elige <strong>Ya tengo cuenta en urbnbee.net</strong>.
              </li>
            </ol>
          </div>

          <div>
            <p className="font-medium">¿Aún no tienes BeeAgent?</p>
            <p className="mt-1 text-[#666]">
              Regístrate en urbnbeeai.com con el <strong>mismo correo</strong> que usas aquí; luego conecta
              desde el agente.
            </p>
            <a
              href={signupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex rounded-full px-5 py-2.5 text-sm font-semibold text-black"
              style={{ backgroundColor: "#dcb81e" }}
            >
              Crear cuenta en urbnbeeai.com
            </a>
          </div>
        </div>

        <div className="mt-8 border-t border-[#eee] pt-6">
          <p className="text-sm font-medium text-[#484848]">Código de vinculación (10 minutos)</p>
          <p className="mt-1 text-xs text-[#888]">
            Úsalo en BeeAgent si tu email en ambos sitios no coincide o prefieres confirmar desde aquí.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void generateCode()}
            className="mt-3 rounded-full border border-[#ddd] bg-white px-5 py-2.5 text-sm font-semibold text-[#484848] hover:bg-[#fafafa] disabled:opacity-50"
          >
            {busy ? "Generando…" : "Generar código"}
          </button>
          {code && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/70">Tu código</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-amber-950">{code}</p>
              {codeExpires && (
                <p className="mt-2 text-xs text-amber-900/80">
                  Expira: {new Date(codeExpires).toLocaleString("es-MX")}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
    </div>
  );
}
