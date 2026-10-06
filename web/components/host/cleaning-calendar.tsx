"use client";

import { type ReactNode, useMemo, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import type { CleaningTaskItem } from "@/components/host/cleaning-task-card";

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Calendario del mes con las limpiezas; al tocar un día se ve a quién le toca y se puede asignar. */
export function CleaningCalendar({
  tasks,
  today,
  listings,
  people = [],
  renderTask,
}: {
  tasks: CleaningTaskItem[];
  /** YYYY-MM-DD en hora de México. */
  today: string;
  listings: { id: string; title: string }[];
  /** Para filtrar por a quién le toca. */
  people?: { id: string; name: string }[];
  renderTask: (task: CleaningTaskItem) => ReactNode;
}) {
  const t = useT();
  const lang = useLang();
  const locale = lang === "en" ? "en-US" : "es-MX";
  const [ty, tm] = today.split("-").map(Number);
  const [month, setMonth] = useState({ y: ty, m: tm - 1 });
  const [listingId, setListingId] = useState("");
  const [person, setPerson] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, CleaningTaskItem[]>();
    for (const task of tasks) {
      if (task.status === "cancelled") continue;
      if (listingId && task.listingId !== listingId) continue;
      if (person && (person === "none" ? task.assignee : task.assignee !== person)) continue;
      map.set(task.date, [...(map.get(task.date) ?? []), task]);
    }
    return map;
  }, [tasks, listingId, person]);

  const first = new Date(Date.UTC(month.y, month.m, 1));
  const daysInMonth = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
  /** La semana empieza en lunes. */
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const title = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i)))
  );
  const shift = (delta: number) => {
    setSelected(null);
    setMonth(({ y, m }) => {
      const d = new Date(Date.UTC(y, m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  };
  const monthPrefix = `${month.y}-${pad(month.m + 1)}-`;
  const inMonth = [...byDay.entries()].filter(([k]) => k.startsWith(monthPrefix)).flatMap(([, v]) => v);
  const unassigned = inMonth.filter((x) => x.status === "pending" && !x.assignee).length;
  const dayTasks = selected ? (byDay.get(selected) ?? []) : [];
  const selectedLabel = selected
    ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
        new Date(`${selected}T12:00:00Z`)
      )
    : "";

  return (
    <section id="calendario" className="scroll-mt-20 rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#222]">{t("Calendario de limpiezas")}</h2>
        <div className="flex max-w-full flex-wrap gap-2">
          <select
            value={listingId}
            onChange={(e) => {
              setListingId(e.target.value);
              setSelected(null);
            }}
            aria-label={t("Anuncio")}
            className="max-w-full rounded-lg border border-[#ddd] bg-white px-2 py-1.5 text-sm text-[#222]"
          >
            <option value="">{t("Todos los anuncios")}</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
          {people.length > 1 && (
            <select
              value={person}
              onChange={(e) => {
                setPerson(e.target.value);
                setSelected(null);
              }}
              aria-label={t("Quién limpia")}
              className="max-w-full rounded-lg border border-[#ddd] bg-white px-2 py-1.5 text-sm text-[#222]"
            >
              <option value="">{t("Todas las personas")}</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {t(p.name)}
                </option>
              ))}
              <option value="none">{t("Sin asignar")}</option>
            </select>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label={t("Mes anterior")}
          className="h-9 w-9 rounded-full border border-[#ddd] text-[#222]"
        >
          ‹
        </button>
        <p className="text-[15px] font-semibold text-[#222] first-letter:uppercase">{title}</p>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label={t("Mes siguiente")}
          className="h-9 w-9 rounded-full border border-[#ddd] text-[#222]"
        >
          ›
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-[#888]">
        {weekdays.map((w, i) => (
          <span key={i} className="py-1 uppercase">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <span key={i} />;
          const key = dayKey(month.y, month.m, d);
          const list = byDay.get(key) ?? [];
          const open = list.filter((x) => x.status === "pending");
          const needs = open.some((x) => !x.assignee);
          const isSel = selected === key;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(isSel ? null : key)}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition ${
                isSel ? "bg-[#222] text-white" : list.length ? "bg-[#fdf6d8] text-[#222]" : "text-[#222] hover:bg-[#f5f5f5]"
              } ${key === today && !isSel ? "ring-1 ring-[#222]" : ""}`}
            >
              <span className={key < today && !list.length ? "text-[#bbb]" : ""}>{d}</span>
              {list.length > 0 && (
                <span className="mt-0.5 flex gap-0.5">
                  {list.slice(0, 3).map((x) => (
                    <span
                      key={x.id}
                      className={`h-1.5 w-1.5 rounded-full ${
                        x.status === "done" ? "bg-[#16a34a]" : !x.assignee ? "bg-amber-500" : isSel ? "bg-white" : "bg-[#222]"
                      }`}
                    />
                  ))}
                </span>
              )}
              {needs && <span className="sr-only">{t("Sin asignar")}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#717171]">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#222]" /> {t("Asignada")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> {t("Sin asignar")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#16a34a]" /> {t("Hecha")}
        </span>
      </div>
      <p className="mt-2 text-sm text-[#717171]">
        {inMonth.length === 0
          ? t("No hay limpiezas este mes.")
          : t(inMonth.length === 1 ? "{n} limpieza este mes" : "{n} limpiezas este mes", { n: inMonth.length })}
        {unassigned > 0 && (
          <span className="font-semibold text-amber-700">
            {" · "}
            {t("{n} sin asignar", { n: unassigned })}
          </span>
        )}
      </p>

      {selected && (
        <div className="mt-4 border-t border-[#f0f0f0] pt-4">
          <p className="text-[15px] font-semibold text-[#222] first-letter:uppercase">{selectedLabel}</p>
          {dayTasks.length === 0 ? (
            <p className="mt-1 text-sm text-[#888]">{t("No hay limpiezas este día.")}</p>
          ) : (
            <ul className="mt-3 space-y-3">{dayTasks.map((task) => renderTask(task))}</ul>
          )}
        </div>
      )}
    </section>
  );
}
