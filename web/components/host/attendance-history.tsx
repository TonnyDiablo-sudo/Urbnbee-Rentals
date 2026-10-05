"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";

type Visit = {
  actor: string;
  name: string;
  day: string;
  listingTitle: string;
  inAt: string;
  outAt: string | null;
  minutes: number | null;
  inOnSite: boolean;
  outOnSite: boolean | null;
  inDistanceM: number;
  outDistanceM: number | null;
};

const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
const today = () => new Date().toLocaleDateString("en-CA");
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

/** Historial de llegadas y salidas de cada persona del equipo de limpieza. */
export function AttendanceHistory({ cleaners }: { cleaners: { id: string; name: string }[] }) {
  const t = useT();
  const lang = useLang();
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sp = new URLSearchParams({ from, to });
    if (actor) sp.set("actor", actor);
    const res = await fetch(`/api/host/cleaning/attendance?${sp}`, { cache: "no-store" }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) return setErr(typeof j.error === "string" ? j.error : "No se pudo cargar.");
    setErr(null);
    setVisits(j.visits ?? []);
  }, [actor, from, to]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  const byDay = new Map<string, Visit[]>();
  for (const v of visits ?? []) byDay.set(v.day, [...(byDay.get(v.day) ?? []), v]);
  const totalMin = (visits ?? []).reduce((s, v) => s + (v.minutes ?? 0), 0);
  const dayLabel = (d: string) =>
    new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
      new Date(`${d}T12:00:00Z`)
    );

  return (
    <section id="asistencia" className="scroll-mt-20 rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[#222]">📍 {t("Entradas y salidas")}</h2>
      <p className="text-sm text-[#717171]">{t("Quién llegó, a qué hora y si marcó desde el alojamiento.")}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <select value={actor} onChange={(e) => setActor(e.target.value)} className="rounded-lg border border-[#ddd] bg-white px-2 py-1.5 text-sm">
          <option value="">{t("Todo el equipo")}</option>
          {cleaners.map((c) => (
            <option key={c.id} value={c.id}>
              {t(c.name)}
            </option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-[#ddd] px-2 py-1.5 text-sm" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-[#ddd] px-2 py-1.5 text-sm" />
      </div>

      {err && <p className="mt-3 text-sm text-red-700">{t(err)}</p>}
      {visits && visits.length === 0 && <p className="mt-3 text-sm text-[#888]">{t("No hay entradas en esas fechas.")}</p>}
      {visits && visits.length > 0 && (
        <p className="mt-3 text-sm text-[#555]">
          {t("{n} visitas · {h} en total", { n: visits.length, h: dur(totalMin) })}
        </p>
      )}

      <div className="mt-3 space-y-4">
        {[...byDay.entries()].map(([day, list]) => (
          <div key={day}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#888] first-letter:uppercase">{dayLabel(day)}</p>
            <ul className="mt-1 divide-y divide-[#f0f0f0]">
              {list.map((v) => (
                <li key={v.inAt + v.actor} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block font-semibold text-[#222]">{t(v.name)}</span>
                    <span className="block truncate text-xs text-[#888]">{v.listingTitle}</span>
                  </span>
                  <span className="text-right">
                    <span className={v.inOnSite ? "text-[#1e7a3a]" : "text-amber-700"}>
                      {hhmm(v.inAt)} {v.inOnSite ? "✓" : `(${v.inDistanceM >= 0 ? `${v.inDistanceM} m` : "?"})`}
                    </span>
                    {" → "}
                    {v.outAt ? (
                      <span className={v.outOnSite ? "text-[#1e7a3a]" : "text-amber-700"}>
                        {hhmm(v.outAt)} {v.outOnSite ? "✓" : `(${v.outDistanceM ?? "?"} m)`}
                      </span>
                    ) : (
                      <span className="text-[#888]">{t("sin salida")}</span>
                    )}
                    {v.minutes !== null && <span className="block text-xs text-[#888]">{dur(v.minutes)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
