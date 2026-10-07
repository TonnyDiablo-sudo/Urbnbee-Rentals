"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";

type Payload = {
  enabled: boolean;
  days: number;
  updatedAt?: string;
  options: readonly number[];
  tools: { family: string; label: string }[];
  maxCollaborators: number;
};

export default function AdminTrialsPage() {
  const t = useT();
  const [data, setData] = useState<Payload | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [days, setDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = (j: Payload) => {
    setData(j);
    setEnabled(j.enabled);
    setDays(j.days);
  };

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/trials", { cache: "no-store" }).catch(() => null);
    if (res?.ok) apply((await res.json()) as Payload);
    else setMsg({ ok: false, text: "No se pudo cargar." });
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/trials", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, days }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return setMsg({ ok: false, text: "No se pudo guardar." });
    apply((await res.json()) as Payload);
    setMsg({ ok: true, text: "Guardado." });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900">{t("Pruebas gratis")}</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-500">
        {t(
          "Para anfitriones que nunca han probado una herramienta: dejan su tarjeta, no se les cobra nada durante la prueba y al terminar se cobra el plan que eligieron. Cada anfitrión tiene una sola prueba por herramienta."
        )}
      </p>

      {!data && !msg && <p className="mt-6 text-gray-400">{t("Cargando…")}</p>}

      {data && (
        <div className="mt-6 max-w-3xl space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{t("Ofrecer prueba gratis a primerizos")}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {t("Apagada: en la Tienda y en los paneles ya no aparece «Probar gratis»; las pruebas que ya empezaron siguen hasta su fecha.")}
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-4 w-4 accent-amber-500"
                />
                {enabled ? t("Encendida") : t("Apagada")}
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-gray-900">{t("Duración de la prueba")}</p>
            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t("Duración de la prueba")}>
              {data.options.map((n) => {
                const on = n === days;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setDays(n)}
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                      on ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    {t("{n} días", { n })}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {t("Aplica a las pruebas que empiecen a partir de ahora. Las que ya están en curso conservan su fecha.")}
            </p>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-gray-900">{t("Herramientas con prueba gratis")}</p>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              {data.tools.map((x) => (
                <li key={x.family} className="flex items-center gap-2">
                  <span className="text-green-700" aria-hidden>
                    ✓
                  </span>
                  {t(x.label)}
                  {x.family === "collaborator_seat" && (
                    <span className="text-xs text-gray-500">{t("(hasta {n} colaboradores)", { n: data.maxCollaborators })}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gray-500">
              {t("El motor de reservas, el anuncio destacado y la verificación de identidad no tienen prueba gratis.")}
            </p>
          </section>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !data}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? t("Guardando…") : t("Guardar")}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{t(msg.text)}</span>}
      </div>
    </div>
  );
}
