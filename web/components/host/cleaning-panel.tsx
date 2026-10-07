"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { CleaningCalendar } from "@/components/host/cleaning-calendar";
import { CleaningTaskCard, type CleaningTaskItem } from "@/components/host/cleaning-task-card";
import { AttendanceHistory } from "@/components/host/attendance-history";
import { SuppliesPanel } from "@/components/host/supplies-panel";
import { ToolPreviewNotice } from "@/components/host/tool-preview-notice";

type Settings = {
  assignMode: "auto" | "manual";
  requirePhoto: boolean;
  requireApproval: boolean;
  confirmHours: number;
  cancelHours: number;
};

type View = {
  /** En marcha (pagada o en prueba). false = vista previa: se configura, no trabaja. */
  active: boolean;
  trialEndsAt?: string;
  trialUsed?: boolean;
  trialDays?: number;
  capacity: number;
  used: number;
  settings: Settings;
  confirmHourOptions: number[];
  cancelHourOptions: number[];
  listings: { id: string; title: string; on: boolean; bound: boolean; cleaner: string | null; cleaners: string[] }[];
  cleaners: { id: string; name: string; listingIds: string[] | "all" }[];
  pendingInvites: number;
  tasks: CleaningTaskItem[];
  today: string;
  recentSince: string;
  attendanceEnabled: boolean;
};

type Tab = "calendario" | "equipo" | "anuncios" | "insumos" | "ajustes";
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "calendario", icon: "🗓️", label: "Calendario" },
  { id: "anuncios", icon: "🏠", label: "Por anuncio" },
  { id: "equipo", icon: "👥", label: "Quién limpia" },
  { id: "insumos", icon: "🧴", label: "Insumos" },
  { id: "ajustes", icon: "⚙️", label: "Ajustes" },
];
const HASH_TAB: Record<string, Tab> = { equipo: "equipo", insumos: "insumos", anuncios: "anuncios", ajustes: "ajustes", como: "ajustes" };

type StatusFilter = "open" | "done" | "all";
const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "open", label: "No hechas" },
  { id: "done", label: "Hechas" },
  { id: "all", label: "Todas" },
];

/** Días alrededor de hoy (para atrás y para adelante); null = sin límite. */
const PERIODS: { days: number | null; label: string }[] = [
  { days: 0, label: "Hoy" },
  { days: 7, label: "7 días" },
  { days: 30, label: "Mes" },
  { days: 90, label: "3 meses" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "Año" },
  { days: null, label: "Todas" },
];

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

const chip = (on: boolean) =>
  `shrink-0 rounded-full border px-3 py-1.5 text-sm ${on ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] bg-white text-[#222]"}`;

const covers = (c: View["cleaners"][number], listingId: string) => c.listingIds === "all" || c.listingIds.includes(listingId);

/** El chat de la app con quien limpia: es el mismo hilo que usa cualquier persona con el anuncio. */
const hostChatPath = (task: CleaningTaskItem) =>
  task.cleanerUserId ? `/host/mensajes/${encodeURIComponent(task.listingId)}/gu_${encodeURIComponent(task.cleanerUserId)}` : null;

const card = "rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm";

/** Herramienta de limpieza: calendario, cada anuncio con quién limpia, insumos y ajustes. */
export function CleaningPanel({ storeHref = "/tienda", teamHref = "/host/colaboradores" }: { storeHref?: string; teamHref?: string }) {
  const t = useT();
  const [data, setData] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("calendario");
  const [picked, setPicked] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [period, setPeriod] = useState<number | null>(30);
  const [extraOpen, setExtraOpen] = useState(false);
  const [manual, setManual] = useState({ listingId: "", date: "", note: "" });

  const load = useCallback(async () => {
    const res = await fetch("/api/host/cleaning", { cache: "no-store" }).catch(() => null);
    if (res?.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      const fromHash = HASH_TAB[window.location.hash.replace("#", "")];
      if (fromHash) setTab(fromHash);
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, [load]);

  function openTab(next: Tab) {
    setTab(next);
    setErr(null);
    window.history.replaceState(null, "", next === "calendario" ? window.location.pathname : `#${next}`);
  }

  async function send(url: string, method: string, body: unknown) {
    setBusy(true);
    setErr(null);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setErr(typeof j.error === "string" ? j.error : "No se pudo guardar.");
      return false;
    }
    if (url === "/api/host/cleaning") setData(j as View);
    else await load();
    return true;
  }

  if (!data) return null;

  const settings = data.settings;
  const pending = data.tasks.filter((x) => x.status === "pending");
  const toApprove = data.tasks.filter((x) => x.status === "done" && x.approval === "pending");
  const unconfirmed = pending.filter((x) => x.needsConfirm);
  const unassigned = pending.filter((x) => !x.assignee);
  const onListings = data.listings.filter((l) => l.on);
  const nameOf = (id: string) => t(data.cleaners.find((c) => c.id === id)?.name ?? "—");

  const hostCard = (task: CleaningTaskItem, extra: { calendar?: boolean } = {}) => (
    <CleaningTaskCard
      key={task.id}
      task={task}
      busy={busy}
      showAssignee
      requirePhoto={settings.requirePhoto}
      chatPath={hostChatPath(task)}
      chatLabel={t("Chat con {name}", { name: t(task.assigneeLabel) })}
      onChanged={load}
      attendance={!extra.calendar && data.attendanceEnabled && task.assignee === "host"}
      cleaners={data.cleaners.filter((c) => covers(c, task.listingId))}
      onAssign={(assignee) => void send(`/api/cleaning/${task.id}`, "PATCH", { assignee })}
      onDone={(d) => void send(`/api/cleaning/${task.id}`, "PATCH", { done: d })}
      onApprove={() => void send(`/api/cleaning/${task.id}`, "PATCH", { approve: true })}
      onRedo={(note) => void send(`/api/cleaning/${task.id}`, "PATCH", { redo: note })}
      onCancel={
        task.status === "pending"
          ? () => {
              if (confirm(t("¿Cancelar esta limpieza?"))) void send(`/api/cleaning/${task.id}`, "PATCH", { cancel: true });
            }
          : undefined
      }
    />
  );

  const whoSummary = (list: string[]) =>
    list.length === 0
      ? t("Nadie asignado todavía")
      : list.length === 1
        ? t("Limpia: {name}", { name: nameOf(list[0]) })
        : t("Limpia: {name} · Respaldo: {backups}", { name: nameOf(list[0]), backups: list.slice(1).map(nameOf).join(", ") });

  const saveList = (listingId: string, list: string[]) => void send("/api/host/cleaning", "PATCH", { listingId, cleaners: list });

  const copyToAll = async (from: View["listings"][number]) => {
    const targets = onListings.filter((x) => x.id !== from.id);
    if (!targets.length || !confirm(t("¿Usar este mismo orden en tus otros {n} anuncios?", { n: targets.length }))) return;
    for (const x of targets) {
      const list = from.cleaners.filter((id) => data.cleaners.some((c) => c.id === id && covers(c, x.id)));
      if (!(await send("/api/host/cleaning", "PATCH", { listingId: x.id, cleaners: list }))) return;
    }
  };

  const priorityEditor = (l: View["listings"][number]) => {
    const notInList = data.cleaners.filter((c) => covers(c, l.id) && !l.cleaners.includes(c.id));
    const move = (i: number, d: number) => {
      const list = [...l.cleaners];
      const j = i + d;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      saveList(l.id, list);
    };
    return (
      <section key={l.id} className={`${card} min-w-0`}>
        <h3 className="truncate text-[16px] font-semibold text-[#222]">{l.title}</h3>
        {l.cleaners.length === 0 ? (
          <p className="mt-2 text-sm text-amber-700">{t("Nadie asignado todavía")}</p>
        ) : (
          <ol className="mt-2 space-y-1.5">
            {l.cleaners.map((id, i) => (
              <li key={id} className="flex items-center gap-2 rounded-xl bg-[#fafafa] px-3 py-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#222] text-xs font-semibold text-white">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-[#222]">{nameOf(id)}</span>
                  <span className={`block text-xs font-semibold ${i === 0 ? "text-[#b8860b]" : "text-[#888]"}`}>
                    {i === 0 ? t("Principal") : t("Respaldo {n}", { n: i })}
                  </span>
                </span>
                <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={t("Subir")} className="h-9 w-9 shrink-0 rounded-full border border-[#ddd] bg-white disabled:opacity-30">
                  ↑
                </button>
                <button type="button" disabled={busy || i === l.cleaners.length - 1} onClick={() => move(i, 1)} aria-label={t("Bajar")} className="h-9 w-9 shrink-0 rounded-full border border-[#ddd] bg-white disabled:opacity-30">
                  ↓
                </button>
                <button type="button" disabled={busy} onClick={() => saveList(l.id, l.cleaners.filter((x) => x !== id))} aria-label={t("Quitar")} className="h-9 w-9 shrink-0 rounded-full border border-[#ddd] bg-white text-[#888]">
                  ×
                </button>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {notInList.length > 0 && (
            <select
              value=""
              disabled={busy}
              onChange={(e) => e.target.value && saveList(l.id, [...l.cleaners, e.target.value])}
              className="rounded-lg border border-[#ddd] bg-white px-2 py-2 text-sm text-[#222]"
            >
              <option value="">{l.cleaners.length ? t("+ Agregar respaldo") : t("+ Agregar persona")}</option>
              {notInList.map((c) => (
                <option key={c.id} value={c.id}>
                  {t(c.name)}
                </option>
              ))}
            </select>
          )}
          {l.cleaners.length > 0 && onListings.length > 1 && (
            <button type="button" disabled={busy} onClick={() => void copyToAll(l)} className="text-sm font-medium text-[#555] underline disabled:opacity-50">
              {t("Usar este orden en todos")}
            </button>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-5">
      {(!data.active || data.trialEndsAt) && (
        <ToolPreviewNotice
          tool="cleaning"
          storeHref={storeHref}
          trialUsed={data.trialUsed}
          trialDays={data.trialDays}
          trialEndsAt={data.active ? data.trialEndsAt : undefined}
        />
      )}
      <nav className="sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto bg-white/95 px-1 py-2 backdrop-blur" aria-label={t("Secciones de limpieza")}>
        {TABS.map((x) => {
          const badge = x.id === "calendario" ? toApprove.length + unconfirmed.length + unassigned.length : 0;
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => openTab(x.id)}
              aria-current={tab === x.id ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === x.id ? "bg-[#222] text-white" : "border border-[#ddd] bg-white text-[#222]"
              }`}
            >
              <span aria-hidden>{x.icon}</span>
              {t(x.label)}
              {badge > 0 && <span className="rounded-full bg-[#dcb81e] px-1.5 text-[11px] text-black">{badge}</span>}
            </button>
          );
        })}
      </nav>

      {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(err)}</p>}

      {tab === "calendario" && (
        <>
          <CleaningCalendar
            tasks={data.tasks}
            today={data.today}
            listings={data.listings.filter((l) => l.on || data.tasks.some((x) => x.listingId === l.id))}
            people={data.cleaners}
            renderTask={(task) => hostCard(task, { calendar: true })}
          />

          {(toApprove.length > 0 || unconfirmed.length > 0 || unassigned.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {(
                [
                  [toApprove.length, "🔎", "Por aprobar"],
                  [unconfirmed.length, "⏳", "Sin confirmar"],
                  [unassigned.length, "⚠️", "Sin asignar"],
                ] as const
              )
                .filter(([n]) => n > 0)
                .map(([n, icon, label]) => (
                  <span key={label} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
                    {icon} <strong>{n}</strong> {t(label)}
                  </span>
                ))}
            </div>
          )}

          {onListings.length === 0 && (
            <p className="text-sm text-[#888]">{t("Agrega en Ajustes los anuncios que quieres en la herramienta.")}</p>
          )}

          {onListings.length > 0 && !extraOpen && (
            <button
              type="button"
              onClick={() => setExtraOpen(true)}
              className="rounded-xl border border-[#222] px-4 py-2.5 text-sm font-semibold text-[#222]"
            >
              {t("+ Agregar limpieza extra")}
            </button>
          )}

          {onListings.length > 0 && extraOpen && (
            <form
              id="extra"
              className={card}
              onSubmit={async (e) => {
                e.preventDefault();
                if (await send("/api/host/cleaning", "POST", manual)) {
                  setManual({ listingId: "", date: "", note: "" });
                  setExtraOpen(false);
                }
              }}
            >
              <h2 className="text-lg font-semibold text-[#222]">{t("Agregar limpieza extra")}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <select
                  required
                  value={manual.listingId}
                  onChange={(e) => setManual({ ...manual, listingId: e.target.value })}
                  className="rounded-xl border border-[#ddd] bg-white px-3 py-2.5 text-[15px] text-[#222]"
                >
                  <option value="">{t("Anuncio")}</option>
                  {onListings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  required
                  value={manual.date}
                  onChange={(e) => setManual({ ...manual, date: e.target.value })}
                  className="rounded-xl border border-[#ddd] px-3 py-2.5 text-[15px] text-[#222]"
                />
              </div>
              <input
                value={manual.note}
                onChange={(e) => setManual({ ...manual, note: e.target.value })}
                placeholder={t("Nota (opcional): cambiar sábanas, revisar alberca…")}
                className="mt-3 w-full rounded-xl border border-[#ddd] px-3 py-2.5 text-[15px] text-[#222]"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-[#222] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {t("Agregar")}
                </button>
                <button type="button" onClick={() => setExtraOpen(false)} className="rounded-xl border border-[#ddd] px-4 py-2.5 text-sm text-[#222]">
                  {t("Cancelar")}
                </button>
              </div>
            </form>
          )}

          {data.attendanceEnabled && <AttendanceHistory cleaners={data.cleaners} />}
        </>
      )}

      {tab === "equipo" && (
        <>
          <section className={card}>
            <h2 className="text-lg font-semibold text-[#222]">{t("Quién limpia cada anuncio")}</h2>
            <p className="mt-1 text-sm text-[#717171]">
              {settings.assignMode === "auto"
                ? t("La persona principal recibe cada limpieza nueva. Si no puede o cancela, pasa sola al respaldo 1, luego al 2, y así.")
                : t("Estás en asignación manual: este orden es tu referencia y tú eliges quién va a cada limpieza.")}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              <button type="button" onClick={() => openTab("ajustes")} className="text-sm font-semibold text-[#222] underline">
                {settings.assignMode === "auto" ? t("Cambiar a asignación manual") : t("Cambiar a asignación automática")}
              </button>
              <a href={teamHref} className="text-sm font-semibold text-[#222] underline">
                {data.pendingInvites > 0 ? t("Tienes invitaciones pendientes") : t("Invitar a quien limpia")}
              </a>
            </div>
          </section>

          {onListings.length === 0 ? (
            <section className={card}>
              <p className="text-sm text-[#555]">{t("Todavía no tienes anuncios en la herramienta.")}</p>
              <button type="button" onClick={() => openTab("ajustes")} className="mt-3 rounded-xl bg-[#222] px-4 py-2 text-sm font-semibold text-white">
                {t("Elegir anuncios en Ajustes")}
              </button>
            </section>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{onListings.map((l) => priorityEditor(l))}</div>
          )}

          {data.cleaners.length > 0 && onListings.length > 0 && (
            <section className={card}>
              <h2 className="text-lg font-semibold text-[#222]">{t("Por persona")}</h2>
              <ul className="mt-2 divide-y divide-[#f0f0f0]">
                {data.cleaners.map((c) => {
                  const main = onListings.filter((l) => l.cleaners[0] === c.id);
                  const backup = onListings.filter((l) => l.cleaners.indexOf(c.id) > 0);
                  return (
                    <li key={c.id} className="py-3">
                      <p className="text-[15px] font-semibold text-[#222]">{t(c.name)}</p>
                      <p className="text-sm text-[#717171]">
                        {main.length === 0 && backup.length === 0
                          ? t("Sin anuncios asignados")
                          : [
                              main.length ? t("Principal en: {list}", { list: main.map((l) => l.title).join(", ") }) : "",
                              backup.length ? t("Respaldo en: {list}", { list: backup.map((l) => l.title).join(", ") }) : "",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      {tab === "anuncios" && (
        <>
          {onListings.length === 0 ? (
            <section className={card}>
              <p className="text-sm text-[#555]">{t("Todavía no tienes anuncios en la herramienta.")}</p>
              <button type="button" onClick={() => openTab("ajustes")} className="mt-3 rounded-xl bg-[#222] px-4 py-2 text-sm font-semibold text-white">
                {t("Elegir anuncios en Ajustes")}
              </button>
            </section>
          ) : (
            <>
              {!picked && (
                <section className={card}>
                  <h2 className="text-lg font-semibold text-[#222]">{t("Elige un anuncio")}</h2>
                  <ul className="mt-2 divide-y divide-[#f0f0f0]">
                    {onListings.map((l) => {
                      const mine = data.tasks.filter((x) => x.listingId === l.id);
                      const todo = mine.filter((x) => x.status === "pending").length;
                      const review = mine.filter((x) => x.status === "done" && x.approval === "pending").length;
                      return (
                        <li key={l.id}>
                          <button type="button" onClick={() => setPicked(l.id)} className="flex w-full items-center gap-3 py-3.5 text-left">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-semibold text-[#222]">{l.title}</span>
                              <span className="block text-sm text-[#717171]">
                                {t("{n} por hacer", { n: todo })}
                                {review > 0 && ` · ${t("{n} por aprobar", { n: review })}`}
                              </span>
                              <span className={`block truncate text-xs ${l.cleaners.length ? "text-[#888]" : "text-amber-700"}`}>{whoSummary(l.cleaners)}</span>
                            </span>
                            <span className="text-xl text-[#bbb]" aria-hidden>
                              ›
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
              {onListings
                .filter((l) => l.id === picked)
                .map((l) => {
                  const shown = data.tasks
                    .filter((x) => x.listingId === l.id)
                    .filter((x) => (statusFilter === "open" ? x.status === "pending" : statusFilter === "done" ? x.status === "done" : true))
                    .filter((x) => period === null || Math.abs(dayDiff(x.date, data.today)) <= period)
                    .sort((a, b) => (statusFilter === "open" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
                  return (
                    <div key={l.id} className="space-y-4">
                    <button type="button" onClick={() => setPicked(null)} className="text-sm font-semibold text-[#222]">
                      ‹ {t("Todos los anuncios")}
                    </button>
                    <section className={card}>
                      <h2 className="text-lg font-semibold text-[#222]">{l.title}</h2>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-[#fafafa] px-3 py-2 text-sm text-[#444]">
                        <span className="min-w-0 flex-1">{whoSummary(l.cleaners)}</span>
                        <button type="button" onClick={() => openTab("equipo")} className="shrink-0 font-semibold text-[#222] underline">
                          {t("Cambiar")}
                        </button>
                      </div>
                      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                        {STATUS_FILTERS.map((f) => (
                          <button key={f.id} type="button" onClick={() => setStatusFilter(f.id)} className={chip(statusFilter === f.id)}>
                            {t(f.label)}
                          </button>
                        ))}
                      </div>
                      <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                        {PERIODS.map((p) => (
                          <button key={p.label} type="button" onClick={() => setPeriod(p.days)} className={chip(period === p.days)}>
                            {t(p.label)}
                          </button>
                        ))}
                      </div>
                      {shown.length === 0 ? (
                        <p className="mt-4 text-sm text-[#888]">{t("No hay limpiezas con estos filtros.")}</p>
                      ) : (
                        <>
                          <p className="mt-3 text-sm text-[#717171]">{t(shown.length === 1 ? "{n} limpieza" : "{n} limpiezas", { n: shown.length })}</p>
                          <ul className="mt-2 space-y-3">{shown.map((task) => hostCard(task))}</ul>
                        </>
                      )}
                    </section>
                    </div>
                  );
                })}
            </>
          )}
        </>
      )}

      {tab === "insumos" && <SuppliesPanel />}

      {tab === "ajustes" && (
        <>
          <section className={card}>
            <h2 className="text-lg font-semibold text-[#222]">{t("Cómo se asignan")}</h2>
            <div className="mt-3 space-y-2 text-sm text-[#222]">
              {(
                [
                  ["auto", "Asignación automática", "Cada limpieza nueva va a la primera persona de la lista de ese anuncio; si cancela, a la siguiente."],
                  ["manual", "Asignación manual", "Te avisamos de cada limpieza nueva y tú eliges quién va."],
                ] as const
              ).map(([mode, label, hint]) => (
                <label key={mode} className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="assignMode"
                    className="mt-0.5 h-4 w-4 accent-[#dcb81e]"
                    checked={settings.assignMode === mode}
                    disabled={busy}
                    onChange={() => void send("/api/host/cleaning", "PATCH", { settings: { assignMode: mode } })}
                  />
                  <span>
                    {t(label)}
                    <span className="block text-xs text-[#888]">{t(hint)}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className={card}>
            <h2 className="text-lg font-semibold text-[#222]">{t("Confirmar y cancelar")}</h2>
            <p className="mt-1 text-sm text-[#717171]">
              {t("En cuanto se crea una limpieza, a quien le toca le llega un aviso para que confirme. Si no confirma a tiempo, te avisamos.")}
            </p>
            <label className="mt-3 block text-sm text-[#222]">
              {t("Debe confirmar a más tardar")}
              <select
                value={settings.confirmHours}
                disabled={busy}
                onChange={(e) => void send("/api/host/cleaning", "PATCH", { settings: { confirmHours: Number(e.target.value) } })}
                className="mt-1 block rounded-lg border border-[#ddd] bg-white px-2 py-1.5 text-sm"
              >
                {data.confirmHourOptions.map((h) => (
                  <option key={h} value={h}>
                    {h === 0 ? t("Antes de empezar") : t("{n} horas antes", { n: h })}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm text-[#222]">
              {t("Puede cancelar hasta")}
              <select
                value={settings.cancelHours}
                disabled={busy}
                onChange={(e) => void send("/api/host/cleaning", "PATCH", { settings: { cancelHours: Number(e.target.value) } })}
                className="mt-1 block rounded-lg border border-[#ddd] bg-white px-2 py-1.5 text-sm"
              >
                {data.cancelHourOptions.map((h) => (
                  <option key={h} value={h}>
                    {h === 0 ? t("Cuando sea, antes de empezar") : t("{n} horas antes", { n: h })}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-[#888]">
                {t("Al cancelar tiene que decir por qué; el motivo te llega y queda en tus notificaciones.")}
              </span>
            </label>
          </section>

          <section className={card}>
            <h2 className="text-lg font-semibold text-[#222]">{t("Al terminar")}</h2>
            <div className="mt-3 space-y-3 text-sm text-[#222]">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[#dcb81e]"
                  checked={settings.requirePhoto}
                  disabled={busy}
                  onChange={(e) => void send("/api/host/cleaning", "PATCH", { settings: { requirePhoto: e.target.checked } })}
                />
                <span>
                  {t("Pedir foto al terminar")}
                  <span className="block text-xs text-[#888]">
                    {t("No se puede marcar como hecha sin al menos una foto. Las fotos se borran solas a los 60 días.")}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[#dcb81e]"
                  checked={settings.requireApproval}
                  disabled={busy}
                  onChange={(e) => void send("/api/host/cleaning", "PATCH", { settings: { requireApproval: e.target.checked } })}
                />
                <span>
                  {t("Aprobar cada limpieza")}
                  <span className="block text-xs text-[#888]">
                    {t("Revisas fotos y comentarios y la apruebas, o le pides a quien limpió que corrija algo.")}
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section className={card}>
            <h2 className="text-lg font-semibold text-[#222]">{t("Anuncios en la herramienta")}</h2>
            {data.active ? (
              <>
                <p className="mt-1 text-sm text-[#717171]">
                  {t("Usas {used} de {cap} anuncios pagados.", { used: data.used, cap: data.capacity })}{" "}
                  <a href={storeHref} className="font-semibold text-[#222] underline">
                    {t("Agregar más en la Tienda")}
                  </a>
                </p>
                <p className="mt-1 text-xs text-[#888]">{t("Cada lugar pagado se queda con el anuncio que elijas; no se puede pasar a otro.")}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-[#717171]">
                {t("Marca los anuncios que entrarán a la herramienta. Al activarla se paga por anuncio y cada lugar se queda con el anuncio que elijas.")}
              </p>
            )}
            <ul className="mt-3 divide-y divide-[#f0f0f0]">
              {data.listings.map((l) => (
                <li key={l.id} className="py-3">
                  <label className="flex min-w-0 items-center gap-2 text-[15px] text-[#222]">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[#dcb81e]"
                      checked={l.on}
                      disabled={busy || (data.active && !l.bound && data.used >= data.capacity)}
                      onChange={(e) => {
                        const on = e.target.checked;
                        if (on && data.active && !l.bound && !confirm(t("El lugar se queda con «{title}» y ya no se puede pasar a otro anuncio. ¿Continuar?", { title: l.title }))) return;
                        void send("/api/host/cleaning", "PATCH", { listingId: l.id, on });
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate">{l.title}</span>
                    {l.bound && <span className="shrink-0 text-xs text-[#888]">{t("🔒 Lugar de este anuncio")}</span>}
                  </label>
                </li>
              ))}
            </ul>
            <a href={teamHref} className="mt-2 inline-block text-sm font-semibold text-[#222] underline">
              {data.pendingInvites > 0 ? t("Tienes invitaciones pendientes") : t("Invita a quien te limpia")}
            </a>
          </section>
        </>
      )}
    </div>
  );
}
