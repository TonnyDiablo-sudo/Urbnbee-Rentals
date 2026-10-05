"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { PromoRibbon } from "@/components/store/store-view";

type Ribbon = { on: boolean; text: string };
type Payload = {
  banner: Ribbon;
  ribbons: Record<string, Ribbon>;
  discountPct: number;
  products: { family: string; label: string }[];
  limits: { ribbon: number; banner: number; pctMin: number; pctMax: number };
  defaults: { ribbon: string; banner: string };
};

const len = (s: string) => Array.from(s).length;

export default function AdminPromosPage() {
  const t = useT();
  const [data, setData] = useState<Payload | null>(null);
  const [banner, setBanner] = useState<Ribbon>({ on: true, text: "" });
  const [ribbons, setRibbons] = useState<Record<string, Ribbon>>({});
  const [pct, setPct] = useState(50);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = (j: Payload) => {
    setData(j);
    setBanner(j.banner);
    setRibbons(j.ribbons);
    setPct(j.discountPct);
  };

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/store-promo", { cache: "no-store" }).catch(() => null);
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
    const res = await fetch("/api/admin/store-promo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ banner, ribbons, discountPct: pct }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return setMsg({ ok: false, text: "No se pudo guardar." });
    apply((await res.json()) as Payload);
    setMsg({ ok: true, text: "Guardado." });
  };

  const setAll = (on: boolean) =>
    setRibbons((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, on }])));

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900">{t("Promociones de la Tienda")}</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-500">
        {t("Lo que cobras no cambia. En cada producto con listón activo se muestra un precio original tachado y, abajo, el precio actual como precio con descuento.")}
      </p>

      {!data && !msg && <p className="mt-6 text-gray-400">{t("Cargando…")}</p>}

      {data && (
        <div className="mt-6 max-w-3xl space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-gray-900">{t("Descuento que se muestra")}</p>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min={data.limits.pctMin}
                max={data.limits.pctMax}
                value={pct}
                onChange={(e) => setPct(Number(e.target.value))}
                className="w-24 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <span className="text-sm text-gray-700">%</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {t("Ejemplo: un producto de $100 se muestra con precio original de ${orig} tachado y $100 con descuento.", {
                orig: pct > 0 && pct < 100 ? Math.round(100 / (1 - pct / 100)) : 100,
              })}{" "}
              {t("Si cambias el porcentaje, cambia también el texto del aviso y de los listones para que digan lo mismo.")}
            </p>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-900">{t("Aviso arriba de la Tienda")}</p>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={banner.on}
                  onChange={(e) => setBanner((b) => ({ ...b, on: e.target.checked }))}
                  className="h-4 w-4 accent-amber-500"
                />
                {t("Activo")}
              </label>
            </div>
            <textarea
              value={banner.text}
              maxLength={data.limits.banner}
              rows={2}
              onChange={(e) => setBanner((b) => ({ ...b, text: e.target.value }))}
              className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <p className="mt-1 text-right text-[11px] text-gray-400">
              {len(banner.text)}/{data.limits.banner}
            </p>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{t("Listón por producto")}</p>
                <p className="text-xs text-gray-500">
                  {t("Máximo {n} caracteres para que quepa en el listón.", { n: data.limits.ribbon })}
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={() => setAll(true)} className="rounded-full border border-gray-200 px-3 py-1">
                  {t("Prender todos")}
                </button>
                <button type="button" onClick={() => setAll(false)} className="rounded-full border border-gray-200 px-3 py-1">
                  {t("Apagar todos")}
                </button>
              </div>
            </div>
            <ul className="mt-4 divide-y divide-gray-100">
              {data.products.map((p) => {
                const r = ribbons[p.family] ?? { on: true, text: data.defaults.ribbon };
                const set = (patch: Partial<Ribbon>) => setRibbons((prev) => ({ ...prev, [p.family]: { ...r, ...patch } }));
                return (
                  <li key={p.family} className="flex flex-wrap items-center gap-4 py-4">
                    <div className="relative h-16 w-40 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                      {r.on && r.text && <PromoRibbon text={r.text} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">{t(p.label)}</p>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={r.on}
                            onChange={(e) => set({ on: e.target.checked })}
                            className="h-4 w-4 accent-amber-500"
                          />
                          {t("Activo")}
                        </label>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          value={r.text}
                          maxLength={data.limits.ribbon}
                          onChange={(e) => set({ text: e.target.value })}
                          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <span className="shrink-0 text-[11px] text-gray-400">
                          {len(r.text)}/{data.limits.ribbon}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
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
