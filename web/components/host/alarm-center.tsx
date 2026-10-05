"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { ALARM_CATEGORIES, type AlarmCategory } from "@/lib/alarm-categories";

export function AlarmCenter() {
  const t = useT();
  const [off, setOff] = useState<AlarmCategory[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<AlarmCategory | "all" | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch("/api/notifications/prefs", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.ok && Array.isArray(j.off)) setOff(j.off);
        else setErr(typeof j.error === "string" ? j.error : "No se pudo cargar.");
      })
      .catch(() => alive && setErr("Error de red."));
    return () => {
      alive = false;
    };
  }, []);

  const toggle = async (id: AlarmCategory | "all", on: boolean) => {
    if (!off) return;
    setBusy(id);
    setErr(null);
    const prev = off;
    if (id === "all") setOff(on ? [] : ALARM_CATEGORIES.map((c) => c.id));
    else setOff(on ? off.filter((x) => x !== id) : [...off, id]);
    const res = await fetch("/api/notifications/prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: id, on }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (res?.ok && Array.isArray(j.off)) setOff(j.off);
    else {
      setOff(prev);
      setErr(typeof j.error === "string" ? j.error : "No se pudo guardar.");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#717171]">
        {t("Elige de qué te avisamos. Todo viene encendido; si apagas algo, deja de llegarte la notificación, el aviso en el celular y el correo de ese tema.")}
      </p>
      {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(err)}</p>}
      {!off && !err && <p className="text-sm text-[#999]">{t("Cargando…")}</p>}
      {off && (
        <>
          <div className="flex gap-2 text-sm">
            <button type="button" disabled={busy !== null} onClick={() => void toggle("all", true)} className="rounded-full border border-[#ddd] px-4 py-1.5 font-medium text-[#222]">
              {t("Prender todo")}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => void toggle("all", false)} className="rounded-full border border-[#ddd] px-4 py-1.5 font-medium text-[#222]">
              {t("Apagar todo")}
            </button>
          </div>
          <ul className="divide-y divide-[#eee] rounded-2xl border border-[#e5e5e5] bg-white">
            {ALARM_CATEGORIES.map((c) => {
              const on = !off.includes(c.id);
              return (
                <li key={c.id} className="flex items-center gap-4 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-[#222]">{t(c.label)}</p>
                    <p className="mt-0.5 text-sm text-[#717171]">{t(c.hint)}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={t(c.label)}
                    disabled={busy === c.id}
                    onClick={() => void toggle(c.id, !on)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-[#1e7a3a]" : "bg-[#ccc]"}`}
                  >
                    <span
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
