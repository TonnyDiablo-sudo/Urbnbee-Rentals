"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { CleaningTaskCard, type CleaningTaskItem } from "@/components/host/cleaning-task-card";

type Settings = { assignMode: "auto" | "manual"; requirePhoto: boolean };

type View = {
  active: boolean;
  capacity: number;
  used: number;
  settings: Settings;
  listings: { id: string; title: string; on: boolean; cleaner: string | null }[];
  cleaners: { id: string; name: string; listingIds: string[] | "all" }[];
  pendingInvites: number;
  tasks: CleaningTaskItem[];
};

const covers = (c: View["cleaners"][number], listingId: string) => c.listingIds === "all" || c.listingIds.includes(listingId);

/** El chat de la app con quien limpia: es el mismo hilo que usa cualquier persona con el anuncio. */
const hostChatPath = (task: CleaningTaskItem) =>
  task.cleanerUserId ? `/host/mensajes/${encodeURIComponent(task.listingId)}/gu_${encodeURIComponent(task.cleanerUserId)}` : null;

/** Herramienta de limpieza: anuncios incluidos, quién limpia y las limpiezas que salen de las reservas. */
export function CleaningPanel({ storeHref = "/tienda", teamHref = "/host/colaboradores" }: { storeHref?: string; teamHref?: string }) {
  const t = useT();
  const [data, setData] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [manual, setManual] = useState({ listingId: "", date: "", note: "" });

  const load = useCallback(async () => {
    const res = await fetch("/api/host/cleaning", { cache: "no-store" }).catch(() => null);
    if (res?.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

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
      <section className="rounded-2xl border border-[#e5e5e5] bg-white p-6 text-center shadow-sm">
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

  const pending = data.tasks.filter((x) => x.status === "pending");
  const done = data.tasks.filter((x) => x.status === "done");
  const onListings = data.listings.filter((l) => l.on);

  return (
    <div className="space-y-6">
      {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(err)}</p>}

      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 text-sm">
        {[
          ["#limpiezas", t("Limpiezas")],
          ["#anuncios", t("Anuncios y quién limpia")],
          ["#como", t("Cómo trabajas")],
          ["#extra", t("Limpieza extra")],
        ].map(([href, label]) => (
          <a key={href} href={href} className="shrink-0 rounded-full border border-[#ddd] bg-white px-3 py-1.5 text-[#222]">
            {label}
          </a>
        ))}
      </nav>

      <section id="limpiezas" className="scroll-mt-20 rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#222]">{t("Próximas limpiezas")}</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-[#888]">
            {onListings.length === 0
              ? t("Agrega abajo los anuncios que quieres en la herramienta.")
              : t("No hay limpiezas pendientes. Se crean solas cuando se confirma una reserva.")}
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pending.map((task) => (
              <CleaningTaskCard
                key={task.id}
                task={task}
                busy={busy}
                requirePhoto={data.settings.requirePhoto}
                chatPath={hostChatPath(task)}
                chatLabel={t("Chat con {name}", { name: task.assigneeLabel })}
                onChanged={load}
                cleaners={data.cleaners.filter((c) => covers(c, task.listingId))}
                onAssign={(assignee) => void send(`/api/cleaning/${task.id}`, "PATCH", { assignee })}
                onDone={(d) => void send(`/api/cleaning/${task.id}`, "PATCH", { done: d })}
                onCancel={() => {
                  if (confirm(t("¿Cancelar esta limpieza?"))) void send(`/api/cleaning/${task.id}`, "PATCH", { cancel: true });
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <section id="como" className="scroll-mt-20 rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#222]">{t("Cómo trabajas")}</h2>
        <div className="mt-3 space-y-2 text-sm text-[#222]">
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="assignMode"
              className="mt-0.5 h-4 w-4 accent-[#dcb81e]"
              checked={data.settings.assignMode === "auto"}
              disabled={busy}
              onChange={() => void send("/api/host/cleaning", "PATCH", { settings: { assignMode: "auto" } })}
            />
            <span>
              {t("Asignación automática")}
              <span className="block text-xs text-[#888]">
                {t("Cada limpieza nueva va a quien limpia ese anuncio (o a la única persona que puede).")}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="assignMode"
              className="mt-0.5 h-4 w-4 accent-[#dcb81e]"
              checked={data.settings.assignMode === "manual"}
              disabled={busy}
              onChange={() => void send("/api/host/cleaning", "PATCH", { settings: { assignMode: "manual" } })}
            />
            <span>
              {t("Asignación manual")}
              <span className="block text-xs text-[#888]">{t("Te avisamos de cada limpieza nueva y tú eliges quién va.")}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 pt-2">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[#dcb81e]"
              checked={data.settings.requirePhoto}
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
        </div>
      </section>

      <section id="anuncios" className="scroll-mt-20 rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#222]">{t("Anuncios y quién limpia")}</h2>
        <p className="mt-1 text-sm text-[#717171]">
          {t("Usas {used} de {cap} anuncios pagados.", { used: data.used, cap: data.capacity })}{" "}
          <a href={storeHref} className="font-semibold text-[#222] underline">
            {t("Agregar más en la Tienda")}
          </a>{" "}
          {data.settings.assignMode === "auto" && t("Elige quién limpia cada anuncio; las nuevas limpiezas se le asignan solas.")}{" "}
          {data.cleaners.length === 1 && (
            <a href={teamHref} className="font-semibold text-[#222] underline">
              {data.pendingInvites > 0 ? t("Tienes invitaciones pendientes") : t("Invita a quien te limpia")}
            </a>
          )}
        </p>
        <ul className="mt-3 divide-y divide-[#f0f0f0]">
          {data.listings.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
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
              {l.on && (
                <select
                  value={l.cleaner ?? ""}
                  disabled={busy}
                  onChange={(e) => void send("/api/host/cleaning", "PATCH", { listingId: l.id, cleaner: e.target.value || null })}
                  className="rounded-lg border border-[#ddd] bg-white px-2 py-1.5 text-sm text-[#222]"
                >
                  <option value="">{t("Sin asignar")}</option>
                  {data.cleaners
                    .filter((c) => covers(c, l.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {t(c.name)}
                      </option>
                    ))}
                </select>
              )}
            </li>
          ))}
        </ul>
      </section>

      {onListings.length > 0 && (
        <form
          id="extra"
          className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm"
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
        <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#222]">{t("Terminadas (últimas 2 semanas)")}</h2>
          <ul className="mt-3 space-y-3">
            {done.map((task) => (
              <CleaningTaskCard
                key={task.id}
                task={task}
                busy={busy}
                chatPath={hostChatPath(task)}
                chatLabel={t("Chat con {name}", { name: task.assigneeLabel })}
                onDone={(d) => void send(`/api/cleaning/${task.id}`, "PATCH", { done: d })}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
