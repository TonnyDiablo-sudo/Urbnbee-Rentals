"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { CleaningCalendar } from "@/components/host/cleaning-calendar";
import { CleaningTaskCard, type CleaningTaskItem } from "@/components/host/cleaning-task-card";
import { AttendanceHistory } from "@/components/host/attendance-history";
import { SuppliesPanel } from "@/components/host/supplies-panel";

type Settings = {
  assignMode: "auto" | "manual";
  requirePhoto: boolean;
  requireApproval: boolean;
  confirmHours: number;
  cancelHours: number;
};

type View = {
  active: boolean;
  capacity: number;
  used: number;
  settings: Settings;
  confirmHourOptions: number[];
  cancelHourOptions: number[];
  listings: { id: string; title: string; on: boolean; cleaner: string | null; cleaners: string[] }[];
  cleaners: { id: string; name: string; listingIds: string[] | "all" }[];
  pendingInvites: number;
  tasks: CleaningTaskItem[];
  today: string;
  recentSince: string;
  attendanceEnabled: boolean;
};

type Tab = "calendario" | "anuncios" | "insumos" | "ajustes";
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "calendario", icon: "🗓️", label: "Calendario" },
  { id: "anuncios", icon: "🏠", label: "Por anuncio" },
  { id: "insumos", icon: "🧴", label: "Insumos" },
  { id: "ajustes", icon: "⚙️", label: "Ajustes" },
];
const HASH_TAB: Record<string, Tab> = { insumos: "insumos", anuncios: "anuncios", ajustes: "ajustes", como: "ajustes" };

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
  const [listingFilter, setListingFilter] = useState("all");
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

  if (!data.active) {
    return (
      <section className={`${card} p-6 text-center`}>
        <p className="text-3xl">🧹</p>
        <h2 className="mt-2 text-lg font-semibold text-[#222]">{t("Herramienta de limpieza")}</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-[#717171]">
          {t("Cada reserva confirmada crea su limpieza para el día de salida, la asignas a tu equipo y les llegan recordatorios. Se paga por anuncio.")}
        </p>
        <a href={storeHref} className="mt-4 inline-block rounded-xl bg-[#222] px-5 py-2.5 text-sm font-semibold text-white">
          {t("Activar en la Tienda")}
        </a>
      </section>
    );
  }

  const settings = data.settings;
  const pending = data.tasks.filter((x) => x.status === "pending");
  const toApprove = data.tasks.filter((x) => x.status === "done" && x.approval === "pending");
  const done = data.tasks.filter((x) => x.status === "done" && x.date >= data.recentSince && x.approval !== "pending");
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

  return (
    <div className="space-y-5">
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
          {(toApprove.length > 0 || unconfirmed.length > 0 || unassigned.length > 0) && (
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                [toApprove.length, "🔎", "Por aprobar"],
                [unconfirmed.length, "⏳", "Sin confirmar"],
                [unassigned.length, "⚠️", "Sin asignar"],
              ]
                .filter(([n]) => (n as number) > 0)
                .map(([n, icon, label]) => (
                  <div key={label as string} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <span className="text-lg">{icon}</span> <strong>{n as number}</strong> {t(label as string)}
                  </div>
                ))}
            </div>
          )}

          {toApprove.length > 0 && (
            <section className={card}>
              <h2 className="text-lg font-semibold text-[#222]">{t("Por aprobar")}</h2>
              <p className="mt-1 text-sm text-[#717171]">{t("Revisa las fotos y comentarios de quien limpió y apruébala o pide que corrija algo.")}</p>
              <ul className="mt-3 space-y-3">{toApprove.map((task) => hostCard(task))}</ul>
            </section>
          )}

          <CleaningCalendar
            tasks={data.tasks}
            today={data.today}
            listings={data.listings.filter((l) => l.on || data.tasks.some((x) => x.listingId === l.id))}
            people={data.cleaners}
            renderTask={(task) => hostCard(task, { calendar: true })}
          />

          <section id="limpiezas" className={card}>
            <h2 className="text-lg font-semibold text-[#222]">{t("Próximas limpiezas")}</h2>
            {pending.length === 0 ? (
              <p className="mt-2 text-sm text-[#888]">
                {onListings.length === 0
                  ? t("Agrega en Ajustes los anuncios que quieres en la herramienta.")
                  : t("No hay limpiezas pendientes. Se crean solas cuando se confirma una reserva.")}
              </p>
            ) : (
              <ul className="mt-3 space-y-3">{pending.map((task) => hostCard(task))}</ul>
            )}
          </section>

          {onListings.length > 0 && (
            <form
              id="extra"
              className={card}
              onSubmit={async (e) => {
                e.preventDefault();
                if (await send("/api/host/cleaning", "POST", manual)) setManual({ listingId: "", date: "", note: "" });
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
              <button
                type="submit"
                disabled={busy}
                className="mt-3 rounded-xl bg-[#222] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t("Agregar")}
              </button>
            </form>
          )}

          {done.length > 0 && (
            <section className={card}>
              <h2 className="text-lg font-semibold text-[#222]">{t("Terminadas (últimas 2 semanas)")}</h2>
              <ul className="mt-3 space-y-3">{done.map((task) => hostCard(task))}</ul>
            </section>
          )}

          {data.attendanceEnabled ? (
            <AttendanceHistory cleaners={data.cleaners} />
          ) : (
            <p className="rounded-2xl border border-dashed border-[#ddd] bg-white px-5 py-4 text-sm text-[#555]">
              📍 <strong>{t("Próximamente incluido")}:</strong>{" "}
              {t("quien limpia marcará su entrada y salida desde el alojamiento, y verás el historial de cada persona por día.")}
            </p>
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
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 text-sm">
                {[["all", t("Todos los anuncios")], ...onListings.map((l) => [l.id, l.title])].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setListingFilter(id)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 ${listingFilter === id ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] bg-white text-[#222]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {onListings
                .filter((l) => listingFilter === "all" || l.id === listingFilter)
                .map((l) => {
                  const able = data.cleaners.filter((c) => covers(c, l.id));
                  const notInList = able.filter((c) => !l.cleaners.includes(c.id));
                  const mine = data.tasks.filter((x) => x.listingId === l.id);
                  const open = mine.filter((x) => x.status === "pending");
                  const review = mine.filter((x) => x.status === "done" && x.approval === "pending");
                  const recent = mine.filter((x) => x.status === "done" && x.approval !== "pending" && x.date >= data.recentSince);
                  const saveList = (list: string[]) => void send("/api/host/cleaning", "PATCH", { listingId: l.id, cleaners: list });
                  const move = (i: number, d: number) => {
                    const list = [...l.cleaners];
                    const j = i + d;
                    if (j < 0 || j >= list.length) return;
                    [list[i], list[j]] = [list[j], list[i]];
                    saveList(list);
                  };
                  return (
                    <section key={l.id} className={card}>
                      <h2 className="text-lg font-semibold text-[#222]">{l.title}</h2>

                      <h3 className="mt-4 text-[15px] font-semibold text-[#222]">{t("Quién limpia (en orden de prioridad)")}</h3>
                      <p className="text-xs text-[#888]">
                        {settings.assignMode === "auto"
                          ? t("A la primera le llega cada limpieza nueva. Si cancela, pasa sola a la siguiente.")
                          : t("Estás en asignación manual: esta lista es tu referencia y tú eliges quién va.")}
                      </p>
                      {l.cleaners.length === 0 ? (
                        <p className="mt-2 text-sm text-amber-700">{t("Nadie asignado todavía")}</p>
                      ) : (
                        <ol className="mt-2 space-y-1.5">
                          {l.cleaners.map((id, i) => (
                            <li key={id} className="flex items-center gap-2 rounded-xl bg-[#fafafa] px-3 py-2">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#222] text-xs font-semibold text-white">{i + 1}</span>
                              <span className="min-w-0 flex-1 truncate text-[15px] text-[#222]">
                                {nameOf(id)}
                                {i === 0 && <span className="ml-2 text-xs font-semibold text-[#b8860b]">{t("Prioridad")}</span>}
                              </span>
                              <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={t("Subir")} className="h-8 w-8 rounded-full border border-[#ddd] bg-white disabled:opacity-30">
                                ↑
                              </button>
                              <button type="button" disabled={busy || i === l.cleaners.length - 1} onClick={() => move(i, 1)} aria-label={t("Bajar")} className="h-8 w-8 rounded-full border border-[#ddd] bg-white disabled:opacity-30">
                                ↓
                              </button>
                              <button type="button" disabled={busy} onClick={() => saveList(l.cleaners.filter((x) => x !== id))} aria-label={t("Quitar")} className="h-8 w-8 rounded-full border border-[#ddd] bg-white text-[#888]">
                                ×
                              </button>
                            </li>
                          ))}
                        </ol>
                      )}
                      {notInList.length > 0 && (
                        <select
                          value=""
                          disabled={busy}
                          onChange={(e) => e.target.value && saveList([...l.cleaners, e.target.value])}
                          className="mt-2 rounded-lg border border-[#ddd] bg-white px-2 py-1.5 text-sm text-[#222]"
                        >
                          <option value="">{t("+ Agregar persona")}</option>
                          {notInList.map((c) => (
                            <option key={c.id} value={c.id}>
                              {t(c.name)}
                            </option>
                          ))}
                        </select>
                      )}
                      {data.cleaners.length === 1 && (
                        <a href={teamHref} className="ml-3 text-sm font-semibold text-[#222] underline">
                          {data.pendingInvites > 0 ? t("Tienes invitaciones pendientes") : t("Invita a quien te limpia")}
                        </a>
                      )}

                      {review.length > 0 && (
                        <>
                          <h3 className="mt-5 text-[15px] font-semibold text-[#222]">{t("Por aprobar")}</h3>
                          <ul className="mt-2 space-y-3">{review.map((task) => hostCard(task))}</ul>
                        </>
                      )}

                      <h3 className="mt-5 text-[15px] font-semibold text-[#222]">{t("Próximas limpiezas")}</h3>
                      {open.length === 0 ? (
                        <p className="mt-1 text-sm text-[#888]">{t("No hay limpiezas pendientes.")}</p>
                      ) : (
                        <ul className="mt-2 space-y-3">{open.map((task) => hostCard(task))}</ul>
                      )}

                      {recent.length > 0 && (
                        <>
                          <h3 className="mt-5 text-[15px] font-semibold text-[#222]">{t("Terminadas (últimas 2 semanas)")}</h3>
                          <ul className="mt-2 space-y-3">{recent.map((task) => hostCard(task))}</ul>
                        </>
                      )}
                    </section>
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
            <p className="mt-1 text-sm text-[#717171]">
              {t("Usas {used} de {cap} anuncios pagados.", { used: data.used, cap: data.capacity })}{" "}
              <a href={storeHref} className="font-semibold text-[#222] underline">
                {t("Agregar más en la Tienda")}
              </a>
            </p>
            <ul className="mt-3 divide-y divide-[#f0f0f0]">
              {data.listings.map((l) => (
                <li key={l.id} className="py-3">
                  <label className="flex min-w-0 items-center gap-2 text-[15px] text-[#222]">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[#dcb81e]"
                      checked={l.on}
                      disabled={busy || (!l.on && data.used >= data.capacity)}
                      onChange={(e) => void send("/api/host/cleaning", "PATCH", { listingId: l.id, on: e.target.checked })}
                    />
                    <span className="truncate">{l.title}</span>
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
