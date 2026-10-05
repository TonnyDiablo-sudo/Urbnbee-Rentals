"use client";

import { useState } from "react";
import { useT } from "@/components/i18n-provider";

export function ResetPasswordButton({ hostId }: { hostId: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function reset() {
    if (!confirm(t("La contraseña temporal anterior dejará de funcionar. ¿Generar una nueva?"))) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/associate/accounts/${hostId}/password`, { method: "POST" }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setErr(typeof j.error === "string" ? t(j.error) : t("No se pudo."));
      return;
    }
    setResult({ email: j.email, password: j.password });
  }

  return (
    <div className="text-right">
      {result ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-left font-mono text-sm text-amber-900">
          <p>
            {t("Usuario:")} {result.email}
          </p>
          <p>
            {t("Contraseña:")} {result.password}
          </p>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void reset()}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-40"
        >
          {busy ? t("Generando…") : t("Generar contraseña temporal")}
        </button>
      )}
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}
