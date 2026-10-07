"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { EmojiPicker } from "@/components/ui/emoji-picker";

type Item = {
  id: string;
  listingId: string | null;
  listingTitle: string | null;
  name: string;
  emoji: string;
  qty: number;
  min: number;
  alertTo: string[];
  low: boolean;
  updatedByName: string;
};

type View = {
  owner: boolean;
  /** false = vista previa: se anotan insumos, pero no sale ningún aviso de compra. */
  live?: boolean;
  items: Item[];
  listings: { id: string; title: string }[];
  recipients: { id: string; name: string }[];
};

const PRESETS = [
  { emoji: "🧻", name: "Papel de baño" },
  { emoji: "🧼", name: "Jabón de manos" },
  { emoji: "🧴", name: "Shampoo" },
  { emoji: "🧽", name: "Esponjas" },
  { emoji: "🗑️", name: "Bolsas de basura" },
  { emoji: "🧺", name: "Detergente" },
  { emoji: "🫧", name: "Limpiador multiusos" },
  { emoji: "☕", name: "Café" },
  { emoji: "🛏️", name: "Juegos de sábanas" },
  { emoji: "🛁", name: "Toallas" },
  { emoji: "💧", name: "Garrafón de agua" },
];

const GENERAL = "general";

type Draft = { emoji: string; name: string; qty: string; min: string; listingId: string; alertTo: string[] };
const EMPTY: Draft = { emoji: "📦", name: "", qty: "0", min: "2", listingId: "", alertTo: ["host"] };

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  const j = res ? await res.json().catch(() => ({})) : {};
  return { ok: Boolean(res?.ok), j: j as Record<string, unknown> };
}

/** Insumos de limpieza: cuántos hay, el mínimo y a quién avisar para comprar. */
export function SuppliesPanel({ hostId }: { hostId?: string }) {
  const t = useT();
  const q = hostId ? `?host=${encodeURIComponent(hostId)}` : "";
  const [data, setData] = useState<View | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await call(`/api/supplies${q}`, "GET");
    if (r.ok) setData(r.j as unknown as View);
  }, [q]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  async function patch(id: string, body: Record<string, unknown>) {
    setErr(null);
    if (typeof body.delta === "number" && data) {
      const delta = body.delta;
      setData({
        ...data,
        items: data.items.map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta), low: Math.max(0, i.qty + delta) <= i.min } : i)),
      });
    }
    const r = await call(`/api/supplies/${id}`, "PATCH", body);
    if (!r.ok) setErr(typeof r.j.error === "string" ? r.j.error : "No se pudo guardar.");
    await load();
  }

  function startAdding() {
    const fromFilter = filter !== "all" ? filter : (data?.listings[0]?.id ?? GENERAL);
    setDraft({ ...EMPTY, listingId: fromFilter });
    setAdding(true);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const r = await call("/api/supplies", "POST", {
      host: hostId,
      emoji: draft.emoji,
      name: draft.name,
      qty: Number(draft.qty),
      min: Number(draft.min),
      listingId: draft.listingId && draft.listingId !== GENERAL ? draft.listingId : null,
      alertTo: draft.alertTo,
    });
    if (!r.ok) return setErr(typeof r.j.error === "string" ? r.j.error : "No se pudo guardar.");
    setData(r.j as unknown as View);
    setDraft(EMPTY);
    setAdding(false);
  }

  async function remove(id: string) {
    if (!confirm(t("¿Quitar este insumo?"))) return;
    await call(`/api/supplies/${id}`, "DELETE");
    setEditing(null);
    await load();
  }

  if (!data) return null;
  const shown = data.items.filter((i) => filter === "all" || (filter === GENERAL ? !i.listingId : i.listingId === filter));
  const low = shown.filter((i) => i.low);
  /** En «Todos», un bloque por anuncio para ver a cuál le falta qué. */
  const groups =
    filter === "all"
      ? [
          ...data.listings.map((l) => ({ id: l.id, title: l.title, items: shown.filter((i) => i.listingId === l.id) })),
          { id: GENERAL, title: t("Bodega / general"), items: shown.filter((i) => !i.listingId) },
        ].filter((g) => g.items.length > 0)
      : [{ id: filter, title: "", items: shown }];
  const lowByPlace = groups
    .map((g) => ({ title: g.title || (filter === GENERAL ? t("Bodega / general") : (data.listings.find((l) => l.id === filter)?.title ?? "")), items: g.items.filter((i) => i.low) }))
    .filter((g) => g.items.length > 0);

  return (
    <section id="insumos" className="scroll-mt-20 rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#222]">🧴 {t("Insumos")}</h2>
          <p className="text-sm text-[#717171]">
            {t("Toca + o − cuando uses o repongas algo. Al llegar al mínimo se avisa para comprar.")}
          </p>
          {data.live === false && (
            <p className="mt-1 text-sm text-[#8a6d00]">
              {t("Vista previa: anota tus insumos desde hoy; los avisos de compra se mandan cuando la herramienta de limpieza esté en marcha.")}
            </p>
          )}
        </div>
        {!adding && (
          <button type="button" onClick={startAdding} className="rounded-xl bg-[#222] px-4 py-2 text-sm font-semibold text-white">
            {t("+ Agregar insumo")}
          </button>
        )}
      </div>

      {(data.listings.length > 0 || data.items.length > 0) && (
        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 text-sm">
          {[
            ["all", t("Todos los anuncios")],
            ...data.listings.map((l) => [l.id, l.title]),
            ...(data.items.some((i) => !i.listingId) ? [[GENERAL, t("Bodega / general")]] : []),
          ].map(([id, label]) => {
            const lowHere = data.items.filter((i) => i.low && (id === "all" || (id === GENERAL ? !i.listingId : i.listingId === id))).length;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 ${filter === id ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] bg-white text-[#222]"}`}
              >
                {label}
                {lowHere > 0 && <span className="ml-1.5 rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">{lowHere}</span>}
              </button>
            );
          })}
        </div>
      )}

      {low.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">🛒 {t("Lista de compras ({n})", { n: low.length })}</p>
          {lowByPlace.map((g) => (
            <p key={g.title} className="mt-1 text-sm text-red-800">
              {lowByPlace.length > 1 || filter === "all" ? <strong>{g.title}: </strong> : null}
              {g.items.map((i) => `${i.emoji} ${t(i.name)}`).join(" · ")}
            </p>
          ))}
        </div>
      )}

      {err && <p className="mt-3 text-sm text-red-700">{t(err)}</p>}

      {adding && (
        <form onSubmit={add} className="mt-4 space-y-3 rounded-xl bg-[#fafafa] p-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setDraft({ ...draft, emoji: p.emoji, name: t(p.name) })}
                className={`rounded-full border px-3 py-1.5 text-sm ${draft.name === t(p.name) ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] bg-white text-[#222]"}`}
              >
                {p.emoji} {t(p.name)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <EmojiPicker value={draft.emoji} onChange={(emoji) => setDraft({ ...draft, emoji })} />
            <input
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder={t("¿Qué es? (papel de baño, jabón…)")}
              maxLength={50}
              className="min-w-0 flex-1 rounded-xl border border-[#ddd] px-3 py-2 text-[15px] text-[#222]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="text-xs text-[#555]">
              {t("Cuántos hay")}
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.qty}
                onChange={(e) => setDraft({ ...draft, qty: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#ddd] px-3 py-2 text-[15px] text-[#222]"
              />
            </label>
            <label className="text-xs text-[#555]">
              {t("Avisar al llegar a")}
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.min}
                onChange={(e) => setDraft({ ...draft, min: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#ddd] px-3 py-2 text-[15px] text-[#222]"
              />
            </label>
            <label className="col-span-2 text-xs text-[#555] sm:col-span-1">
              {t("¿De qué anuncio?")}
              <select
                required
                value={draft.listingId}
                onChange={(e) => setDraft({ ...draft, listingId: e.target.value })}
                className="mt-1 w-full rounded-xl border border-[#ddd] bg-white px-3 py-2 text-[15px] text-[#222]"
              >
                {data.listings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
                <option value={GENERAL}>{t("Bodega / general")}</option>
              </select>
            </label>
          </div>
          {data.owner && data.recipients.length > 1 && (
            <Recipients
              recipients={data.recipients}
              value={draft.alertTo}
              onChange={(alertTo) => setDraft({ ...draft, alertTo })}
            />
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={!draft.name.trim()} className="rounded-xl bg-[#222] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {t("Guardar")}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-xl border border-[#ddd] px-4 py-2 text-sm text-[#222]">
              {t("Cancelar")}
            </button>
          </div>
        </form>
      )}

      {data.items.length === 0 && !adding && (
        <p className="mt-4 text-sm text-[#888]">{t("Agrega lo que usan en tus limpiezas: papel de baño, jabones, bolsas… lo que quieras.")}</p>
      )}
      {data.items.length > 0 && shown.length === 0 && !adding && (
        <p className="mt-4 text-sm text-[#888]">{t("Este anuncio todavía no tiene insumos. Agrégalos para saber qué le falta.")}</p>
      )}

      {groups.map((g) => (
      <div key={g.id} className="mt-4">
      {g.title && (
        <h3 className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-[#222]">
          <span className="truncate">{g.title}</span>
          {g.items.some((i) => i.low) && (
            <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
              {t("Faltan {n}", { n: g.items.filter((i) => i.low).length })}
            </span>
          )}
        </h3>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {g.items.map((i) => {
          const pct = Math.min(100, Math.round((i.qty / Math.max(1, i.min * 3)) * 100));
          const color = i.low ? "bg-red-500" : i.qty <= i.min * 2 ? "bg-amber-400" : "bg-emerald-500";
          return (
            <li key={i.id} className={`relative rounded-2xl border p-3 ${i.low ? "border-red-300 bg-red-50/60" : "border-[#e5e5e5] bg-white"}`}>
              {i.low && (
                <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                  {t("Comprar")}
                </span>
              )}
              <p className="text-3xl" aria-hidden>
                {i.emoji}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#222]">{t(i.name)}</p>
              <p className="truncate text-[11px] text-[#888]">{i.listingTitle ?? t("Bodega / general")}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eee]">
                <div className={`h-full ${color}`} style={{ width: `${Math.max(4, pct)}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-1">
                <button
                  type="button"
                  aria-label={t("Quitar uno")}
                  disabled={i.qty === 0}
                  onClick={() => void patch(i.id, { delta: -1 })}
                  className="h-11 w-11 rounded-full border border-[#ddd] bg-white text-2xl leading-none text-[#222] disabled:opacity-30"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const v = prompt(t("¿Cuántos hay de {name}?", { name: t(i.name) }), String(i.qty));
                    if (v !== null && v.trim() !== "" && Number.isFinite(Number(v))) void patch(i.id, { qty: Number(v) });
                  }}
                  className="min-w-0 text-center"
                >
                  <span className={`block text-2xl font-bold ${i.low ? "text-red-700" : "text-[#222]"}`}>{i.qty}</span>
                  <span className="block text-[10px] text-[#888]">{t("mín. {n}", { n: i.min })}</span>
                </button>
                <button
                  type="button"
                  aria-label={t("Agregar uno")}
                  onClick={() => void patch(i.id, { delta: 1 })}
                  className="h-11 w-11 rounded-full bg-[#222] text-2xl leading-none text-white"
                >
                  +
                </button>
              </div>
              {data.owner && (
                <button type="button" onClick={() => setEditing(editing === i.id ? null : i.id)} className="mt-2 text-xs text-[#555] underline">
                  {t("Ajustes")}
                </button>
              )}
              {data.owner && editing === i.id && (
                <ItemSettings
                  item={i}
                  recipients={data.recipients}
                  onSave={(body) => {
                    setEditing(null);
                    void patch(i.id, body);
                  }}
                  onRemove={() => void remove(i.id)}
                />
              )}
            </li>
          );
        })}
      </ul>
      </div>
      ))}
    </section>
  );
}

function Recipients({
  recipients,
  value,
  onChange,
}: {
  recipients: { id: string; name: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const t = useT();
  return (
    <fieldset>
      <legend className="text-xs text-[#555]">{t("Avisar a")}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {recipients.map((r) => {
          const on = value.includes(r.id);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onChange(on ? value.filter((x) => x !== r.id) : [...value, r.id])}
              className={`rounded-full border px-3 py-1 text-xs ${on ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] bg-white text-[#222]"}`}
            >
              {on ? "✓ " : ""}
              {t(r.name)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ItemSettings({
  item,
  recipients,
  onSave,
  onRemove,
}: {
  item: Item;
  recipients: { id: string; name: string }[];
  onSave: (body: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const [min, setMin] = useState(String(item.min));
  const [alertTo, setAlertTo] = useState(item.alertTo);
  const [emoji, setEmoji] = useState(item.emoji);
  const [name, setName] = useState(item.name);
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-white p-2 ring-1 ring-[#eee]">
      <div className="flex gap-1.5">
        <EmojiPicker value={emoji} onChange={setEmoji} size="sm" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          aria-label={t("Nombre")}
          className="min-w-0 flex-1 rounded-lg border border-[#ddd] px-2 py-1.5 text-sm text-[#222]"
        />
      </div>
      <label className="block text-xs text-[#555]">
        {t("Avisar al llegar a")}
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[#ddd] px-2 py-1.5 text-sm text-[#222]"
        />
      </label>
      {recipients.length > 1 && <Recipients recipients={recipients} value={alertTo} onChange={setAlertTo} />}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onSave({ min: Number(min), alertTo, emoji, ...(name.trim() ? { name } : {}) })}
          className="rounded-lg bg-[#222] px-3 py-1.5 text-xs font-semibold text-white"
        >
          {t("Guardar")}
        </button>
        <button type="button" onClick={onRemove} className="text-xs text-red-700 underline">
          {t("Quitar")}
        </button>
      </div>
    </div>
  );
}
