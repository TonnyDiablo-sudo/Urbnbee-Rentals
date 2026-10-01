"use client";

import { useState } from "react";
import { useT } from "@/components/i18n-provider";
import {
  TAX_COUNTRIES,
  computeStayTax,
  taxLineLabel,
  taxPresetFor,
  type HostTaxSettings,
} from "@/lib/stay-tax";
import { mutateCached, useCached } from "../../_components/cached-fetch";
import { TopBar } from "../../_components/top-bar";

const URL = "/api/host/tax";
const EXAMPLE_MXN = 1000;

type Row = { name: string; rate: string };

export function TaxEditor() {
  const { data, error } = useCached<{ tax?: HostTaxSettings | null }>(URL);
  const t = useT();
  return (
    <div className="pb-[calc(110px+env(safe-area-inset-bottom))]">
      <TopBar title={t("Impuestos (IVA)")} back="/host/menu" />
      {!data ? (
        <p className="px-5 py-6 text-sm text-[#999]">{error ? t("No se pudo cargar.") : t("Cargando…")}</p>
      ) : (
        <Form initial={data.tax ?? null} />
      )}
    </div>
  );
}

function Form({ initial }: { initial: HostTaxSettings | null }) {
  const t = useT();
  const start = initial ?? { ...taxPresetFor("MX"), enabled: false };
  const [enabled, setEnabled] = useState(start.enabled);
  const [country, setCountry] = useState(start.country);
  const [mode, setMode] = useState<HostTaxSettings["mode"]>(start.mode);
  const [rows, setRows] = useState<Row[]>(start.lines.map((l) => ({ name: l.name, rate: String(l.ratePct) })));
  const [taxId, setTaxId] = useState(start.taxId ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const settings: HostTaxSettings = {
    enabled,
    country,
    mode,
    lines: rows
      .map((r) => ({ name: r.name.trim(), ratePct: Number(r.rate.replace(",", ".")) }))
      .filter((l) => l.name && Number.isFinite(l.ratePct) && l.ratePct > 0),
    taxId: taxId.trim() || undefined,
  };
  const example = computeStayTax({ ...settings, enabled: true }, EXAMPLE_MXN);

  const pickCountry = (code: string) => {
    setCountry(code);
    const p = taxPresetFor(code);
    setMode(p.mode);
    setRows(p.lines.map((l) => ({ name: l.name, rate: String(l.ratePct) })));
    setMsg(null);
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tax: settings }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: typeof j.error === "string" ? j.error : "No se pudo guardar." });
        return;
      }
      mutateCached(URL, () => ({ tax: j.tax }));
      setMsg({ ok: true, text: "Guardado. Aplica a las reservas nuevas." });
    } catch {
      setMsg({ ok: false, text: "Sin conexión." });
    } finally {
      setBusy(false);
    }
  };

  const money = (n: number) => `$${n.toLocaleString("es-MX")}`;
  const input = "mt-1 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-[15px] outline-none focus:border-[#222]";

  return (
    <div className="space-y-5 px-5 pt-4">
      <p className="text-[15px] leading-relaxed text-[#484848]">
        {t(
          "Si facturas, cobra el IVA y los impuestos de hospedaje de tu país. Se muestran al huésped antes de reservar, se cobran junto con la estancia y quedan en el contrato."
        )}
      </p>

      <label className="flex items-center justify-between gap-4 rounded-2xl border border-[#ebebeb] p-4">
        <span>
          <span className="block text-[15px] font-semibold text-[#222]">{t("Cobrar impuestos")}</span>
          <span className="block text-xs text-[#888]">{t("Apagado: tus precios se cobran tal cual.")}</span>
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            setMsg(null);
          }}
          className="h-6 w-6 accent-[#dcb81e]"
        />
      </label>

      {enabled && (
        <>
          <label className="block text-sm font-medium text-[#222]">
            {t("País")}
            <select value={country} onChange={(e) => pickCountry(e.target.value)} className={`${input} bg-white`}>
              {TAX_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {t(c.label)}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="text-sm font-medium text-[#222]">{t("Impuestos")}</p>
            <p className="text-xs text-[#888]">{t("Ajusta el porcentaje a tu estado o municipio (p. ej. el ISH varía de 2% a 5%).")}</p>
            <ul className="mt-2 space-y-2">
              {rows.map((r, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input
                    value={r.name}
                    onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    placeholder={t("Nombre")}
                    aria-label={t("Nombre")}
                    className="min-w-0 flex-1 rounded-xl border border-[#ccc] px-3 py-2.5 text-[15px]"
                  />
                  <div className="flex w-24 items-center rounded-xl border border-[#ccc] pr-2">
                    <input
                      value={r.rate}
                      inputMode="decimal"
                      onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))}
                      aria-label={t("Porcentaje")}
                      className="w-full min-w-0 rounded-xl px-3 py-2.5 text-right text-[15px] outline-none"
                    />
                    <span className="text-sm text-[#717171]">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
                    className="h-10 w-10 shrink-0 rounded-full text-xl text-[#999]"
                    aria-label={t("Quitar")}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            {rows.length < 4 && (
              <button
                type="button"
                onClick={() => setRows((p) => [...p, { name: "", rate: "" }])}
                className="mt-2 text-sm font-semibold text-[#222] underline"
              >
                {t("Agregar impuesto")}
              </button>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-[#222]">{t("¿Tus precios ya incluyen impuestos?")}</legend>
            {(
              [
                ["added", "No, súmalos al total del huésped"],
                ["included", "Sí, ya vienen incluidos en mi precio"],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className="flex items-center gap-3 rounded-xl border border-[#ebebeb] px-4 py-3 text-[15px] text-[#222]">
                <input type="radio" name="mode" checked={mode === v} onChange={() => setMode(v)} className="h-5 w-5 accent-[#dcb81e]" />
                {t(label)}
              </label>
            ))}
          </fieldset>

          <label className="block text-sm font-medium text-[#222]">
            {t("Registro fiscal (RFC, NIF, NIT…) — opcional")}
            <input value={taxId} onChange={(e) => setTaxId(e.target.value)} className={input} />
            <span className="mt-1 block text-xs font-normal text-[#888]">{t("Aparece en el contrato de cada reserva.")}</span>
          </label>

          <div className="rounded-2xl bg-[#f7f7f7] p-4 text-sm text-[#333]">
            <p className="mb-2 font-semibold text-[#222]">{t("Ejemplo con una estancia de {amount}", { amount: money(EXAMPLE_MXN) })}</p>
            {example.lines.map((l) => (
              <div key={l.name} className="flex justify-between">
                <span>
                  {example.included ? `${t("Incluye")} ` : ""}
                  {taxLineLabel(l)}
                </span>
                <span>{money(l.amountMxn)}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-[#e2e2e2] pt-2 font-semibold">
              <span>{t("El huésped paga")}</span>
              <span>{money(EXAMPLE_MXN + example.addedMxn)}</span>
            </div>
          </div>
        </>
      )}

      {msg && (
        <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-[#e6f6ea] text-[#1e7a3a]" : "bg-red-50 text-red-700"}`}>
          {t(msg.text)}
        </p>
      )}
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="w-full rounded-xl bg-[#dcb81e] py-3.5 text-[15px] font-semibold text-black disabled:opacity-60"
      >
        {busy ? t("Guardando…") : t("Guardar")}
      </button>
    </div>
  );
}
