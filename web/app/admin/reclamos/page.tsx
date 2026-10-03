"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingSlug?: string;
  listingExists: boolean;
  kind: "claim" | "remove";
  name: string;
  contact: string;
  message: string;
  status: "open" | "done";
  resolution?: string;
  createdAt: string;
  hostEmail?: string;
  hostClaimed: boolean;
  provisionedBy?: string;
};

const RESOLUTION: Record<string, string> = {
  listing_deleted: "Anuncio borrado",
  handed_over: "Cuenta entregada",
  dismissed: "Descartado",
};

export default function AdminClaimsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/claims")
      .then((res) => res.json())
      .catch(() => ({}))
      .then((j: { claims?: Row[] }) => {
        if (alive) setRows(Array.isArray(j.claims) ? j.claims : []);
      });
    return () => {
      alive = false;
    };
  }, [version]);

  async function act(id: string, action: string) {
    if (action === "delete_listing" && !confirm("¿Borrar el anuncio de forma definitiva?")) return;
    setBusy(id);
    await fetch("/api/admin/claims", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setBusy(null);
    void load();
  }

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">Reclamos de anuncios</h1>
      <p className="mt-1 mb-6 text-sm text-gray-500">
        Personas que dicen ser dueñas de un anuncio dado de alta por asociados, o que piden borrarlo.
      </p>
      {rows === null ? (
        <p className="text-gray-400 animate-pulse">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400">Sin solicitudes.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    <span
                      className={`mr-2 rounded px-2 py-0.5 text-xs ${
                        r.kind === "remove" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      }`}
                    >
                      {r.kind === "remove" ? "Borrar" : "Reclamar"}
                    </span>
                    {r.listingSlug && r.listingExists ? (
                      <a href={`/listings/${r.listingSlug}`} target="_blank" rel="noreferrer" className="underline">
                        {r.listingTitle}
                      </a>
                    ) : (
                      r.listingTitle
                    )}
                  </p>
                  <p className="mt-1 text-sm text-gray-700">
                    {r.name} · <span className="font-mono">{r.contact}</span>
                  </p>
                  {r.message && <p className="mt-1 text-sm text-gray-500">“{r.message}”</p>}
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(r.createdAt).toLocaleString("es-MX")} · Cuenta: {r.hostEmail ?? "—"}
                    {r.provisionedBy ? ` · Alta por ${r.provisionedBy}` : ""}
                    {r.hostClaimed ? " · ya reclamada" : ""}
                  </p>
                </div>
                {r.status === "open" ? (
                  <div className="flex flex-wrap gap-2">
                    {r.listingExists && (
                      <button
                        disabled={busy === r.id}
                        onClick={() => void act(r.id, "delete_listing")}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                      >
                        Borrar anuncio
                      </button>
                    )}
                    <button
                      disabled={busy === r.id}
                      onClick={() => void act(r.id, "handed_over")}
                      className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                    >
                      Cuenta entregada
                    </button>
                    <button
                      disabled={busy === r.id}
                      onClick={() => void act(r.id, "dismiss")}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 disabled:opacity-40"
                    >
                      Descartar
                    </button>
                  </div>
                ) : (
                  <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                    {RESOLUTION[r.resolution ?? ""] ?? "Atendido"}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
