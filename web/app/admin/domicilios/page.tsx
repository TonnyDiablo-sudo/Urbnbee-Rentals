"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingSlug?: string;
  hostEmail?: string;
  mime: string;
  addressSnapshot: string;
  status: "pending" | "approved" | "rejected" | "review";
  aiError?: string;
  hostMessage?: string;
  reviewedBy?: string;
  createdAt: string;
  ai?: {
    model: string;
    verdict: string;
    documentType: string;
    holderName?: string;
    addressOnDocument?: string;
    issueDate?: string;
    addressMatch: string;
    recent: boolean;
    tamperingSigns: boolean;
    confidence: number;
    reasons: string[];
  };
};

const STATUS: Record<Row["status"], [string, string]> = {
  review: ["Por revisar", "bg-amber-100 text-amber-800"],
  pending: ["Procesando", "bg-gray-100 text-gray-600"],
  approved: ["Aprobado", "bg-green-100 text-green-800"],
  rejected: ["Rechazado", "bg-red-100 text-red-700"],
};

export default function AdminAddressProofsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [onlyReview, setOnlyReview] = useState(true);
  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/address-proofs")
      .then((res) => res.json())
      .catch(() => ({}))
      .then((j: { proofs?: Row[] }) => {
        if (alive) setRows(Array.isArray(j.proofs) ? j.proofs : []);
      });
    return () => {
      alive = false;
    };
  }, [version]);

  async function act(id: string, action: "approve" | "reject") {
    const message = action === "reject" ? (prompt("Mensaje para el anfitrión (opcional):") ?? undefined) : undefined;
    setBusy(id);
    await fetch("/api/admin/address-proofs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, message }),
    });
    setBusy(null);
    load();
  }

  const shown = (rows ?? []).filter((r) => !onlyReview || r.status === "review" || r.status === "pending");

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">Comprobantes de domicilio</h1>
      <p className="mt-1 mb-4 text-sm text-gray-500">
        La IA aprueba o rechaza sola los casos claros. Aquí quedan los dudosos, y el historial de todos.
      </p>
      <label className="mb-6 inline-flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} />
        Sólo pendientes de revisión
      </label>
      {rows === null ? (
        <p className="text-gray-400 animate-pulse">Cargando…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-gray-400">Nada por revisar.</p>
      ) : (
        <div className="space-y-4">
          {shown.map((r) => (
            <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">
                    {r.listingSlug ? (
                      <a href={`/listings/${r.listingSlug}`} target="_blank" rel="noreferrer" className="hover:underline">
                        {r.listingTitle}
                      </a>
                    ) : (
                      r.listingTitle
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {r.hostEmail} · {new Date(r.createdAt).toLocaleString("es-MX")}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS[r.status][1]}`}>
                  {STATUS[r.status][0]}
                  {r.reviewedBy === "ai" ? " por IA" : ""}
                </span>
              </div>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-gray-400">Dirección del anuncio</dt>
                  <dd className="text-gray-900">{r.addressSnapshot}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-400">Dirección en el documento</dt>
                  <dd className="text-gray-900">{r.ai?.addressOnDocument ?? "—"}</dd>
                </div>
                {r.ai && (
                  <>
                    <div>
                      <dt className="text-xs text-gray-400">Documento</dt>
                      <dd className="text-gray-900">
                        {r.ai.documentType} · {r.ai.issueDate ?? "sin fecha"} · titular: {r.ai.holderName ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-400">IA ({r.ai.model})</dt>
                      <dd className="text-gray-900">
                        coincide: {r.ai.addressMatch} · reciente: {r.ai.recent ? "sí" : "no"} · alteración:{" "}
                        {r.ai.tamperingSigns ? "posible" : "no"} · confianza {Math.round(r.ai.confidence * 100)}%
                      </dd>
                    </div>
                  </>
                )}
              </dl>
              {r.ai?.reasons.length ? (
                <ul className="mt-3 list-disc pl-5 text-sm text-gray-600">
                  {r.ai.reasons.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              ) : null}
              {r.aiError && <p className="mt-3 text-sm text-red-600">Error de la IA: {r.aiError}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={`/api/admin/address-proofs/${r.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Ver comprobante
                </a>
                {r.status !== "approved" && (
                  <button
                    disabled={busy === r.id}
                    onClick={() => void act(r.id, "approve")}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Aprobar
                  </button>
                )}
                {r.status !== "rejected" && (
                  <button
                    disabled={busy === r.id}
                    onClick={() => void act(r.id, "reject")}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
