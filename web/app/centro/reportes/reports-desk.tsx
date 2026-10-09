"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";

type Row = {
  id: string;
  category: string;
  message: string;
  answers: { where: string; ongoing: string } | null;
  status: string;
  createdAt: string;
  aiDecision: "pending" | "suspend" | "keep" | "error" | null;
  aiReason: string;
  targetName: string;
  suspended: boolean;
  listingTitle: string;
};

export function ReportsDesk() {
  const t = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [canModerate, setCanModerate] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    fetch("/api/centro/reports", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((j: { reports?: Row[]; canModerate?: boolean }) => {
        setRows(j.reports ?? []);
        setCanModerate(Boolean(j.canModerate));
      })
      .catch(() => setError(t("No tienes acceso a esta sección.")));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: "hide_messages" | "unpublish") {
    setNote("");
    const res = await fetch("/api/centro/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) as { error?: string; detail?: string };
    setNote(j.detail ? t(j.detail) : j.error ? t(j.error) : t("No se pudo guardar."));
    if (res?.ok) load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">{t("Reportes de cuentas")}</h1>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {note && <p className="text-sm text-gray-700">{note}</p>}
      {rows === null ? (
        <p className="text-sm text-gray-400">{t("Cargando…")}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">{t("No hay reportes.")}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className="font-semibold text-gray-800">{t(r.category)}</span>
                {r.targetName && <span>· {r.targetName}</span>}
                {r.suspended && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">{t("Suspendida")}</span>}
                {r.aiDecision === "keep" && <span>{t("No se suspendió")}</span>}
              </div>
              {r.answers && (
                <p className="mt-1 text-xs text-gray-500">
                  {t(r.answers.where)} · {t(r.answers.ongoing)}
                </p>
              )}
              {r.aiReason && <p className="mt-1 text-xs text-gray-500">{r.aiReason}</p>}
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{r.message}</p>
              {canModerate && r.listingTitle && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void act(r.id, "hide_messages")} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs">
                    {t("Ocultar mensajes de este chat")}
                  </button>
                  <button type="button" onClick={() => void act(r.id, "unpublish")} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs">
                    {t("Retirar anuncio")}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
