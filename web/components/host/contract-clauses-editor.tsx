"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/i18n-provider";
import {
  defaultClauseLayout,
  layoutFromClauseOverrides,
  type ContractClauseEdit,
  type EditableContractClause,
} from "@/lib/booking-contract-templates";

export type ContractDefaults = { clauses: EditableContractClause[]; law: string };

/** Cláusulas y ley aplicable de fábrica del anuncio (para prellenar el editor). */
export function useContractDefaults(listingId: string): ContractDefaults | null | undefined {
  const [d, setD] = useState<ContractDefaults | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    setD(undefined);
    fetch(`/api/host/contracts?listingId=${encodeURIComponent(listingId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        setD(j && Array.isArray(j.clauses) ? { clauses: j.clauses, law: typeof j.law === "string" ? j.law : "" } : null);
      })
      .catch(() => alive && setD(null));
    return () => {
      alive = false;
    };
  }, [listingId]);
  return d;
}

/** Secciones que se muestran: las guardadas, o el formato anterior convertido, o las de fábrica. */
export function effectiveClauseLayout(
  defaults: ContractDefaults,
  layout: ContractClauseEdit[] | undefined,
  legacyOverrides?: Record<string, string>
): ContractClauseEdit[] {
  if (layout) return layout;
  if (legacyOverrides && Object.keys(legacyOverrides).length) return layoutFromClauseOverrides(defaults.clauses, legacyOverrides);
  return defaultClauseLayout(defaults.clauses);
}

type Row = {
  entry: ContractClauseEdit;
  base?: EditableContractClause;
  title: string;
  text: string;
  locked: boolean;
  kind: "fixed" | "new" | "edited" | "renamed" | "original";
};

function rowOf(entry: ContractClauseEdit, clauses: EditableContractClause[]): Row {
  const base = entry.base ? clauses.find((c) => c.title === entry.base) : undefined;
  const locked = Boolean(base?.locked);
  const title = locked ? base!.title : entry.title.trim() || base?.title || "";
  const text = locked ? base!.text : (entry.text ?? base?.text ?? "");
  const kind: Row["kind"] = locked
    ? "fixed"
    : !base
      ? "new"
      : entry.text !== undefined && entry.text.trim() !== base.text.trim()
        ? "edited"
        : title !== base.title
          ? "renamed"
          : "original";
  return { entry, base, title, text, locked, kind };
}

/**
 * Editor de las secciones del contrato: cambiar texto, renombrar, reordenar, quitar, agregar y volver
 * al texto de fábrica. También el apartado de ley aplicable.
 */
export function ContractClausesEditor({
  defaults,
  layout,
  legacyOverrides,
  onLayout,
  law,
  onLaw,
  compact,
}: {
  defaults: ContractDefaults | null | undefined;
  /** `undefined` = secciones de fábrica sin tocar. */
  layout: ContractClauseEdit[] | undefined;
  /** Formato anterior (texto por título); se convierte al tocar algo. */
  legacyOverrides?: Record<string, string>;
  onLayout: (next: ContractClauseEdit[] | undefined) => void;
  law: string | undefined;
  onLaw: (next: string | undefined) => void;
  compact?: boolean;
}) {
  const t = useT();
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);

  if (defaults === undefined) return <p className="text-sm text-[#999]">{t("Cargando cláusulas…")}</p>;
  if (defaults === null) return <p className="text-sm text-red-700">{t("No se pudieron cargar las cláusulas.")}</p>;

  const current = effectiveClauseLayout(defaults, layout, legacyOverrides);
  const rows = current.map((e) => rowOf(e, defaults.clauses));
  const removed = defaults.clauses.filter((c) => !c.locked && !current.some((e) => e.base === c.title));
  const customized =
    layout !== undefined || Boolean(legacyOverrides && Object.keys(legacyOverrides).length) || (law !== undefined && law.trim() !== defaults.law.trim());

  const update = (next: ContractClauseEdit[]) => onLayout(next);
  const setEntry = (i: number, patch: Partial<ContractClauseEdit>) =>
    update(current.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= current.length) return;
    const next = [...current];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };
  const remove = (i: number) => {
    if (rows[i].locked) return;
    update(current.filter((_, j) => j !== i));
    setEditing(null);
  };
  const reinclude = (c: EditableContractClause) => {
    const idx = defaults.clauses.findIndex((x) => x.title === c.title);
    let at = 0;
    for (let k = idx - 1; k >= 0; k--) {
      const pos = current.findIndex((e) => e.base === defaults.clauses[k].title);
      if (pos >= 0) {
        at = pos + 1;
        break;
      }
    }
    const next = [...current];
    next.splice(at, 0, { base: c.title, title: c.title });
    update(next);
  };
  const add = (title: string, text: string) => {
    // Las secciones nuevas van antes de la cláusula fija y la de validez, que cierran el contrato.
    const tail = current.findIndex((e) => {
      const b = e.base ? defaults.clauses.find((c) => c.title === e.base) : undefined;
      return b?.locked;
    });
    const next = [...current];
    next.splice(tail < 0 ? next.length : tail, 0, { title, text });
    update(next);
    setEditing(null);
  };
  const reset = () => {
    if (!confirm(t("Se quitan todos tus cambios al texto del contrato y vuelve el de fábrica. ¿Continuar?"))) return;
    onLayout(undefined);
    onLaw(undefined);
    setEditing(null);
  };

  const kindLabel: Record<Row["kind"], string> = {
    fixed: t("Fija"),
    new: t("Nueva"),
    edited: t("Editada"),
    renamed: t("Renombrada"),
    original: t("Original"),
  };
  const kindClass: Record<Row["kind"], string> = {
    fixed: "bg-[#f0f0f0] text-[#666]",
    new: "bg-[#e8f3ea] text-[#1e7a3a]",
    edited: "bg-[#fff4cc] text-[#7a5a00]",
    renamed: "bg-[#fff4cc] text-[#7a5a00]",
    original: "bg-[#f0f0f0] text-[#666]",
  };
  const btn = compact
    ? "flex h-10 w-10 items-center justify-center rounded-full text-[#555] active:bg-[#f0f0f0] disabled:opacity-25"
    : "flex h-8 w-8 items-center justify-center rounded-full text-[#555] hover:bg-[#f0f0f0] disabled:opacity-25";

  return (
    <div className="space-y-3">
      {customized && (
        <button type="button" onClick={reset} className="text-sm font-semibold text-[#222] underline">
          {t("Volver al contrato original")}
        </button>
      )}

      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="rounded-xl border border-[#e5e5e5] bg-white">
            <button
              type="button"
              onClick={() => setEditing(i)}
              className="flex w-full items-start gap-3 px-3.5 pt-3 text-left"
              aria-label={t("Editar «{title}»", { title: r.title })}
            >
              <span className="mt-0.5 w-5 shrink-0 text-[13px] font-semibold tabular-nums text-[#999]">{i + 1}.</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[13px] font-bold tracking-wide text-[#222]">{r.title || t("Sin título")}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${kindClass[r.kind]}`}>{kindLabel[r.kind]}</span>
                </span>
                <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-[#717171]">{r.text || t("Sin texto")}</span>
              </span>
            </button>
            <div className="flex items-center justify-end gap-0.5 px-2 pb-1 pt-0.5">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={btn} aria-label={t("Subir")}>
                <IconArrow up />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className={btn} aria-label={t("Bajar")}>
                <IconArrow />
              </button>
              <button type="button" onClick={() => setEditing(i)} className={`${btn} w-auto px-3 text-[13px] font-semibold text-[#222]`}>
                {r.locked ? t("Leer") : t("Editar")}
              </button>
              <button type="button" onClick={() => remove(i)} disabled={r.locked} className={`${btn} text-red-700`} aria-label={t("Quitar sección")}>
                <IconTrash />
              </button>
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={() => setEditing("new")}
        className={`flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#bbb] font-semibold text-[#222] ${compact ? "py-3 text-[15px]" : "py-2.5 text-sm"}`}
      >
        <span className="text-lg leading-none">+</span>
        {t("Agregar sección")}
      </button>

      {removed.length > 0 && (
        <div className="rounded-xl bg-[#fafafa] px-3.5 py-2.5">
          <button type="button" onClick={() => setShowRemoved((v) => !v)} className="flex w-full items-center justify-between text-sm text-[#555]">
            <span>{t("Secciones quitadas ({n})", { n: removed.length })}</span>
            <span className="text-[#888]">{showRemoved ? "–" : "+"}</span>
          </button>
          {showRemoved && (
            <ul className="mt-2 space-y-2">
              {removed.map((c) => (
                <li key={c.title} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-[#888] line-through">{c.title}</span>
                  <button type="button" onClick={() => reinclude(c)} className="shrink-0 font-semibold text-[#222] underline">
                    {t("Volver a incluir")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <label className="block pt-1">
        <span className="text-sm font-medium text-[#222]">{t("Ley aplicable y tribunales")}</span>
        <textarea
          rows={3}
          value={law ?? defaults.law}
          onChange={(e) => onLaw(e.target.value)}
          className={
            compact
              ? "mt-2 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-[15px] leading-relaxed outline-none focus:border-[#222]"
              : "mt-2 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#222]"
          }
        />
        {law !== undefined && law.trim() !== defaults.law.trim() && (
          <button type="button" onClick={() => onLaw(undefined)} className="mt-1 text-sm font-semibold text-[#222] underline">
            {t("Restaurar texto original")}
          </button>
        )}
      </label>

      {editing === "new" && <NewSectionSheet onClose={() => setEditing(null)} onAdd={add} />}
      {typeof editing === "number" && rows[editing] && (
        <SectionSheet
          row={rows[editing]}
          onClose={() => setEditing(null)}
          onTitle={(v) => setEntry(editing, { title: v })}
          onText={(v) => setEntry(editing, { text: v })}
          onRestore={() => {
            const b = rows[editing].base;
            setEntry(editing, { title: b?.title ?? rows[editing].entry.title, text: undefined });
          }}
          onRemove={() => remove(editing)}
        />
      )}
    </div>
  );
}

function SectionSheet({
  row,
  onClose,
  onTitle,
  onText,
  onRestore,
  onRemove,
}: {
  row: Row;
  onClose: () => void;
  onTitle: (v: string) => void;
  onText: (v: string) => void;
  onRestore: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  const canRestore = Boolean(row.base) && (row.kind === "edited" || row.kind === "renamed");
  return (
    <Modal title={row.locked ? t("Cláusula fija") : t("Editar sección")} onClose={onClose}>
      {row.locked ? (
        <>
          <p className="text-[13px] font-bold tracking-wide text-[#222]">{row.title}</p>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-[#444]">{row.text}</p>
          <p className="mt-3 text-sm text-[#888]">{t("Esta cláusula explica que el contrato es entre tú y el huésped. No se puede cambiar ni quitar.")}</p>
        </>
      ) : (
        <>
          <label className="block">
            <span className="text-sm font-medium text-[#222]">{t("Título de la sección")}</span>
            <input
              value={row.entry.title}
              onChange={(e) => onTitle(e.target.value.slice(0, 120))}
              placeholder={row.base?.title}
              className="mt-1.5 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-base font-semibold uppercase tracking-wide outline-none focus:border-[#222]"
            />
          </label>
          <label className="mt-4 block">
            <span className="text-sm font-medium text-[#222]">{t("Texto")}</span>
            <textarea
              value={row.entry.text ?? row.base?.text ?? ""}
              onChange={(e) => onText(e.target.value.slice(0, 6000))}
              rows={Math.min(16, Math.max(8, Math.ceil((row.text.length || 1) / 55) + 2))}
              className="mt-1.5 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-[15px] leading-relaxed outline-none focus:border-[#222]"
            />
          </label>
          <p className="mt-2 text-xs text-[#888]">{t("Los datos de las partes, fechas y montos se llenan solos en cada reserva.")}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold">
            {canRestore && (
              <button type="button" onClick={onRestore} className="text-[#222] underline">
                {t("Restaurar texto original")}
              </button>
            )}
            <button type="button" onClick={onRemove} className="text-red-700 underline">
              {t("Quitar sección")}
            </button>
          </div>
        </>
      )}
      <button type="button" onClick={onClose} className="mt-6 w-full rounded-xl bg-[#222] py-3.5 text-[15px] font-semibold text-white">
        {t("Listo")}
      </button>
    </Modal>
  );
}

function NewSectionSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (title: string, text: string) => void }) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const ok = title.trim().length >= 2 && text.trim().length >= 10;
  return (
    <Modal title={t("Nueva sección")} onClose={onClose}>
      <label className="block">
        <span className="text-sm font-medium text-[#222]">{t("Título de la sección")}</span>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 120))}
          placeholder={t("Ej. MASCOTAS")}
          className="mt-1.5 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-base font-semibold uppercase tracking-wide outline-none focus:border-[#222]"
        />
      </label>
      <label className="mt-4 block">
        <span className="text-sm font-medium text-[#222]">{t("Texto")}</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 6000))}
          rows={8}
          placeholder={t("Ej. Se permite una mascota pequeña previo aviso. El huésped responde por los daños que cause.")}
          className="mt-1.5 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-[15px] leading-relaxed outline-none focus:border-[#222]"
        />
      </label>
      <button
        type="button"
        disabled={!ok}
        onClick={() => onAdd(title.trim(), text.trim())}
        className="mt-6 w-full rounded-xl bg-[#222] py-3.5 text-[15px] font-semibold text-white disabled:opacity-40"
      >
        {t("Agregar sección")}
      </button>
    </Modal>
  );
}

/** Hoja que sube desde abajo; se usa igual en la app y en la web. */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const t = useT();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-white sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center border-b border-[#f0f0f0] px-5 py-4">
          <span className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-[#ddd] sm:hidden" />
          <h2 className="text-base font-semibold text-[#222]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 flex h-9 w-9 items-center justify-center rounded-full text-xl text-[#555] hover:bg-[#f5f5f5]"
            aria-label={t("Cerrar")}
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5" style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function IconArrow({ up }: { up?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {up ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
    </svg>
  );
}
