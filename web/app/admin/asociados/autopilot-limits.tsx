"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/i18n-provider";

/** Topes diarios del piloto automático por página; cada asociado Plus tiene los suyos en cada una. */
export function AutopilotLimitsForm({ limits, max }: { limits: Record<string, number>; max: number }) {
  const t = useT();
  const router = useRouter();
  const [values, setValues] = useState(() => Object.fromEntries(Object.entries(limits).map(([k, v]) => [k, String(v)])));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = Object.entries(limits).some(([k, v]) => values[k] !== String(v));

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/autopilot", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limits: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v || 0)])) }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setMsg({ ok: false, text: typeof j.error === "string" ? j.error : t("No se pudo guardar.") });
      return;
    }
    setMsg({ ok: true, text: t("Guardado.") });
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">{t("Piloto automático: tope diario por página")}</h2>
      <p className="mt-1 text-xs text-gray-500">
        {t("Cada asociado Plus puede traer hasta este número de anuncios al día de cada página. Facebook va más bajo porque usa la cuenta personal del asociado.")}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {Object.keys(limits).map((site) => (
          <label key={site} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-1.5 text-sm">
            <span className="text-gray-700">{site}</span>
            <input
              type="number"
              min={0}
              max={max}
              value={values[site] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [site]: e.target.value }))}
              className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm"
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={() => void save()}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? t("Guardando…") : t("Guardar topes")}
        </button>
        {msg && <span className={`text-xs ${msg.ok ? "text-green-700" : "text-red-700"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
