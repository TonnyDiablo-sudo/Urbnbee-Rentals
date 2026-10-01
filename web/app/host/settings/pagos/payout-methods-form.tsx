"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";

type Methods = {
  clabe: { holder: string; clabe: string; bank?: string } | null;
  zelle: { name: string; contact: string } | null;
  cashapp: { name: string; cashtag: string } | null;
  oxxo: { holder: string; reference: string; note?: string } | null;
};

const empty: Methods = { clabe: null, zelle: null, cashapp: null, oxxo: null };

export function PayoutMethodsForm() {
  const t = useT();
  const [saved, setSaved] = useState<Methods>(empty);
  const [clabeHolder, setClabeHolder] = useState("");
  const [clabe, setClabe] = useState("");
  const [bank, setBank] = useState("");
  const [zelleName, setZelleName] = useState("");
  const [zelleContact, setZelleContact] = useState("");
  const [cashName, setCashName] = useState("");
  const [cashtag, setCashtag] = useState("");
  const [oxxoHolder, setOxxoHolder] = useState("");
  const [oxxoRef, setOxxoRef] = useState("");
  const [oxxoNote, setOxxoNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const fill = useCallback((m: Methods) => {
    setSaved(m);
    setClabeHolder(m.clabe?.holder ?? "");
    setClabe(m.clabe?.clabe ?? "");
    setBank(m.clabe?.bank ?? "");
    setZelleName(m.zelle?.name ?? "");
    setZelleContact(m.zelle?.contact ?? "");
    setCashName(m.cashapp?.name ?? "");
    setCashtag(m.cashapp?.cashtag ?? "");
    setOxxoHolder(m.oxxo?.holder ?? "");
    setOxxoRef(m.oxxo?.reference ?? "");
    setOxxoNote(m.oxxo?.note ?? "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/host/settings/payout-methods", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j) fill(j as Methods);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [fill]);

  async function put(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setErr(null);
    setOk(null);
    const res = await fetch("/api/host/settings/payout-methods", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setErr(typeof j.error === "string" ? j.error : "No se pudo guardar.");
      return;
    }
    fill(j as Methods);
    setOk(done);
  }

  const field = "mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm";

  return (
    <section className="rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-[#484848]">{t("Otras formas de cobro")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[#666]">
        {t(
          "El huésped te paga directo. Guarda tu CLABE, Zelle, Cash App u Oxxo y, en cada reserva, se los envías con un clic. Cuando te pague, tú confirmas y les aparece a los dos."
        )}
      </p>
      {err && <p className="mt-3 text-sm text-red-700">{t(err)}</p>}
      {ok && <p className="mt-3 text-sm text-emerald-800">{t(ok)}</p>}

      <div className="mt-5 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-[#222]">CLABE</h3>
          {saved.clabe && (
            <p className="mt-1 text-xs text-emerald-800">
              {t("Guardada")} · {saved.clabe.holder} · {saved.clabe.clabe}
            </p>
          )}
          <label className="mt-2 block text-sm text-[#484848]">
            {t("Titular")}
            <input value={clabeHolder} onChange={(e) => setClabeHolder(e.target.value)} className={field} />
          </label>
          <label className="mt-2 block text-sm text-[#484848]">
            CLABE
            <input inputMode="numeric" value={clabe} onChange={(e) => setClabe(e.target.value)} className={field} />
          </label>
          <label className="mt-2 block text-sm text-[#484848]">
            {t("Banco (opcional)")}
            <input value={bank} onChange={(e) => setBank(e.target.value)} className={field} />
          </label>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void put({ clabe: { holder: clabeHolder, clabe, bank } }, "CLABE guardada.")}
              className="rounded-lg bg-[#111] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {t("Guardar CLABE")}
            </button>
            {saved.clabe && (
              <button type="button" disabled={busy} onClick={() => void put({ clabe: null }, "CLABE quitada.")} className="text-sm underline">
                {t("Quitar")}
              </button>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[#222]">Zelle</h3>
          {saved.zelle && (
            <p className="mt-1 text-xs text-emerald-800">
              {t("Guardada")} · {saved.zelle.name} · {saved.zelle.contact}
            </p>
          )}
          <label className="mt-2 block text-sm text-[#484848]">
            {t("Nombre")}
            <input value={zelleName} onChange={(e) => setZelleName(e.target.value)} className={field} />
          </label>
          <label className="mt-2 block text-sm text-[#484848]">
            {t("Correo o teléfono")}
            <input value={zelleContact} onChange={(e) => setZelleContact(e.target.value)} className={field} />
          </label>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void put({ zelle: { name: zelleName, contact: zelleContact } }, "Zelle guardado.")}
              className="rounded-lg bg-[#111] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {t("Guardar Zelle")}
            </button>
            {saved.zelle && (
              <button type="button" disabled={busy} onClick={() => void put({ zelle: null }, "Zelle quitado.")} className="text-sm underline">
                {t("Quitar")}
              </button>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[#222]">Cash App</h3>
          {saved.cashapp && (
            <p className="mt-1 text-xs text-emerald-800">
              {t("Guardada")} · {saved.cashapp.name} · {saved.cashapp.cashtag}
            </p>
          )}
          <label className="mt-2 block text-sm text-[#484848]">
            {t("Nombre")}
            <input value={cashName} onChange={(e) => setCashName(e.target.value)} className={field} />
          </label>
          <label className="mt-2 block text-sm text-[#484848]">
            $cashtag
            <input value={cashtag} onChange={(e) => setCashtag(e.target.value)} placeholder="$tunombre" className={field} />
          </label>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void put({ cashapp: { name: cashName, cashtag } }, "Cash App guardado.")}
              className="rounded-lg bg-[#111] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {t("Guardar Cash App")}
            </button>
            {saved.cashapp && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void put({ cashapp: null }, "Cash App quitado.")}
                className="text-sm underline"
              >
                {t("Quitar")}
              </button>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[#222]">Oxxo</h3>
          {saved.oxxo && (
            <p className="mt-1 text-xs text-emerald-800">
              {t("Guardada")} · {saved.oxxo.holder} · {saved.oxxo.reference}
            </p>
          )}
          <label className="mt-2 block text-sm text-[#484848]">
            {t("A nombre de")}
            <input value={oxxoHolder} onChange={(e) => setOxxoHolder(e.target.value)} className={field} />
          </label>
          <label className="mt-2 block text-sm text-[#484848]">
            {t("Referencia")}
            <input value={oxxoRef} onChange={(e) => setOxxoRef(e.target.value)} className={field} />
          </label>
          <label className="mt-2 block text-sm text-[#484848]">
            {t("Nota para el huésped (opcional)")}
            <input value={oxxoNote} onChange={(e) => setOxxoNote(e.target.value)} className={field} />
          </label>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void put({ oxxo: { holder: oxxoHolder, reference: oxxoRef, note: oxxoNote } }, "Oxxo guardado.")
              }
              className="rounded-lg bg-[#111] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {t("Guardar Oxxo")}
            </button>
            {saved.oxxo && (
              <button type="button" disabled={busy} onClick={() => void put({ oxxo: null }, "Oxxo quitado.")} className="text-sm underline">
                {t("Quitar")}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
