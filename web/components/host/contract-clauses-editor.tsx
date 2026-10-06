"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import type { EditableContractClause } from "@/lib/booking-contract";

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

/**
 * Deja editar cada cláusula del contrato (o quitarla) y el apartado de ley aplicable.
 * `overrides` guarda sólo lo que cambió el anfitrión; cadena vacía = cláusula quitada.
 */
export function ContractClausesEditor({
  defaults,
  overrides,
  onOverrides,
  law,
  onLaw,
  compact,
}: {
  defaults: ContractDefaults | null | undefined;
  overrides: Record<string, string>;
  onOverrides: (next: Record<string, string>) => void;
  law: string | undefined;
  onLaw: (next: string | undefined) => void;
  compact?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);

  if (defaults === undefined) return <p className="text-sm text-[#999]">{t("Cargando cláusulas…")}</p>;
  if (defaults === null) return <p className="text-sm text-red-700">{t("No se pudieron cargar las cláusulas.")}</p>;

  const setClause = (title: string, text: string | undefined) => {
    const next = { ...overrides };
    if (text === undefined) delete next[title];
    else next[title] = text;
    onOverrides(next);
  };

  const area = compact
    ? "mt-2 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-[15px] leading-relaxed outline-none focus:border-[#222]"
    : "mt-2 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#222]";

  return (
    <div className="space-y-2">
      {defaults.clauses.map((cl) => {
        const o = overrides[cl.title];
        const removed = o === "";
        const edited = o !== undefined && !removed && o.trim() !== cl.text.trim();
        const isOpen = open === cl.title;
        return (
          <div key={cl.title} className={`rounded-xl border ${removed ? "border-dashed border-[#ccc] bg-[#fafafa]" : "border-[#e5e5e5] bg-white"}`}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : cl.title)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
            >
              <span className="min-w-0">
                <span className={`block text-[13px] font-bold tracking-wide ${removed ? "text-[#999] line-through" : "text-[#222]"}`}>
                  {cl.title}
                </span>
                <span className="mt-0.5 block text-xs text-[#888]">
                  {cl.locked
                    ? t("Cláusula fija de la herramienta de reservas")
                    : removed
                      ? t("Quitada del contrato")
                      : edited
                        ? t("Texto editado por ti")
                        : t("Texto original")}
                </span>
              </span>
              <span className="shrink-0 text-[#888]">{isOpen ? "–" : "+"}</span>
            </button>
            {isOpen && (
              <div className="px-3.5 pb-3.5">
                {cl.locked ? (
                  <p className="text-sm leading-relaxed text-[#555]">{cl.text}</p>
                ) : removed ? (
                  <>
                    <p className="text-sm leading-relaxed text-[#999]">{cl.text}</p>
                    <button type="button" onClick={() => setClause(cl.title, undefined)} className="mt-2 text-sm font-semibold text-[#222] underline">
                      {t("Volver a incluir")}
                    </button>
                  </>
                ) : (
                  <>
                    <textarea
                      rows={compact ? 6 : 5}
                      value={o ?? cl.text}
                      onChange={(e) => setClause(cl.title, e.target.value)}
                      className={area}
                    />
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-[#222]">
                      {edited && (
                        <button type="button" onClick={() => setClause(cl.title, undefined)} className="underline">
                          {t("Restaurar texto original")}
                        </button>
                      )}
                      <button type="button" onClick={() => setClause(cl.title, "")} className="text-red-700 underline">
                        {t("Quitar esta cláusula")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      <label className="block pt-2">
        <span className="text-sm font-medium text-[#222]">{t("Ley aplicable y tribunales")}</span>
        <textarea
          rows={3}
          value={law ?? defaults.law}
          onChange={(e) => onLaw(e.target.value)}
          className={area}
        />
        {law !== undefined && law.trim() !== defaults.law.trim() && (
          <button type="button" onClick={() => onLaw(undefined)} className="mt-1 text-sm font-semibold text-[#222] underline">
            {t("Restaurar texto original")}
          </button>
        )}
      </label>
    </div>
  );
}

/** Deja en `overrides` sólo lo que de verdad difiere del texto de fábrica. */
export function pruneClauseOverrides(overrides: Record<string, string>, defaults: ContractDefaults | null | undefined): Record<string, string> {
  if (!defaults) return overrides;
  const out: Record<string, string> = {};
  for (const [title, text] of Object.entries(overrides)) {
    const base = defaults.clauses.find((c) => c.title === title);
    if (!base || base.locked) continue;
    if (text === "" || text.trim() !== base.text.trim()) out[title] = text.trim();
  }
  return out;
}
