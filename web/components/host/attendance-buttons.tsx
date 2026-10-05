"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { acceptDisclosure, currentFix, disclosureAccepted, LOCATION_PURPOSE } from "@/lib/native-location";

type State = { inAt: string | null; inOnSite: boolean | null; outAt: string | null; outOnSite: boolean | null };

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/** Marcar llegada y salida de una limpieza con la ubicación del momento. */
export function AttendanceButtons({ taskId }: { taskId: string }) {
  const t = useT();
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [asking, setAsking] = useState<"in" | "out" | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/cleaning/${taskId}/attendance`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) setS(await res.json());
  }, [taskId]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  async function punch(kind: "in" | "out") {
    setBusy(true);
    setErr(null);
    const fix = await currentFix();
    if ("error" in fix) {
      setBusy(false);
      return setErr(fix.error);
    }
    const res = await fetch(`/api/cleaning/${taskId}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...fix }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) return setErr(typeof j.error === "string" ? j.error : "No se pudo guardar.");
    setS(j as State);
  }

  function start(kind: "in" | "out") {
    if (disclosureAccepted()) void punch(kind);
    else setAsking(kind);
  }

  if (!s) return null;
  const inside = Boolean(s.inAt && !s.outAt);

  return (
    <div className="mt-3 rounded-xl bg-[#f7f7f7] p-3">
      {asking && (
        <div className="mb-3 rounded-xl border border-[#ddd] bg-white p-3 text-sm text-[#222]">
          <p className="font-semibold">📍 {t("Usaremos tu ubicación")}</p>
          <p className="mt-1 text-[#555]">{t(LOCATION_PURPOSE)}</p>
          <p className="mt-1 text-[#555]">{t("No te seguimos ni leemos tu ubicación en ningún otro momento.")}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                acceptDisclosure();
                const k = asking;
                setAsking(null);
                void punch(k);
              }}
              className="rounded-lg bg-[#222] px-3 py-1.5 text-sm font-semibold text-white"
            >
              {t("Continuar")}
            </button>
            <button type="button" onClick={() => setAsking(null)} className="rounded-lg border border-[#ddd] px-3 py-1.5 text-sm">
              {t("Ahora no")}
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {s.inAt && (
          <span className={s.inOnSite ? "text-[#1e7a3a]" : "text-amber-700"}>
            {t("Entrada {h}", { h: hhmm(s.inAt) })} {s.inOnSite ? "✓" : `· ${t("fuera del lugar")}`}
          </span>
        )}
        {s.outAt && (
          <span className={s.outOnSite ? "text-[#1e7a3a]" : "text-amber-700"}>
            · {t("Salida {h}", { h: hhmm(s.outAt) })} {s.outOnSite ? "✓" : `· ${t("fuera del lugar")}`}
          </span>
        )}
        <span className="flex-1" />
        {!inside ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => start("in")}
            className="rounded-lg bg-[#1e7a3a] px-3 py-1.5 font-semibold text-white disabled:opacity-50"
          >
            {busy ? t("Ubicando…") : s.outAt ? t("📍 Marcar otra entrada") : t("📍 Marcar entrada")}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => start("out")}
            className="rounded-lg bg-[#222] px-3 py-1.5 font-semibold text-white disabled:opacity-50"
          >
            {busy ? t("Ubicando…") : t("📍 Marcar salida")}
          </button>
        )}
      </div>
      {err && <p className="mt-2 text-xs text-red-700">{t(err)}</p>}
    </div>
  );
}
