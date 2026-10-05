"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminReportRow } from "@/lib/admin-user-detail";
import {
  REPORT_KINDS,
  REPORT_STATUS_LABEL,
  reportKindLabel,
  type UserReportKind,
  type UserReportStatus,
} from "@/lib/user-reports-types";

const STATUS_BADGE: Record<UserReportStatus, string> = {
  open: "bg-red-100 text-red-700",
  in_review: "bg-amber-100 text-amber-800",
  resolved: "bg-green-100 text-green-800",
  dismissed: "bg-gray-100 text-gray-600",
};

const KIND_BADGE: Record<UserReportKind, string> = {
  report_account: "bg-red-50 text-red-700 border-red-200",
  claim_account: "bg-purple-50 text-purple-700 border-purple-200",
  complaint: "bg-orange-50 text-orange-700 border-orange-200",
  suggestion: "bg-blue-50 text-blue-700 border-blue-200",
};

const sel = "rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400";

function ReportCard({ r, onSaved }: { r: AdminReportRow; onSaved: () => void }) {
  const [note, setNote] = useState(r.adminNote ?? "");
  const [reply, setReply] = useState(r.adminReply ?? "");
  const [target, setTarget] = useState(r.targetEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(r.status === "open");

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, ...patch }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg((j as { error?: string }).error ?? "No se pudo guardar.");
      return;
    }
    setMsg("Guardado.");
    onSaved();
  }

  return (
    <li className="rounded-xl border border-gray-200 bg-white">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status]}`}>{REPORT_STATUS_LABEL[r.status]}</span>
        <span className={`rounded border px-2 py-0.5 text-xs font-medium ${KIND_BADGE[r.kind]}`}>{reportKindLabel(r.kind)}</span>
        <span className="text-sm font-medium text-gray-900">{r.category}</span>
        {r.targetOpenReports > 1 && (
          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{r.targetOpenReports} reportes abiertos contra esta cuenta</span>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {r.reporterName} · {new Date(r.createdAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
        </span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-gray-100 px-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Quién lo envía</p>
              <p className="mt-1">
                <Link href={`/admin/users/${r.reporterId}`} className="font-medium text-amber-700 hover:underline">
                  {r.reporterName}
                </Link>{" "}
                <span className="text-gray-500">· {r.reporterEmail}</span>
              </p>
              <p className="text-xs text-gray-400">
                Desde modo {r.reporterMode === "host" ? "anfitrión" : "huésped"}
                {r.contact && <> · Contacto: {r.contact}</>}
              </p>
            </div>
            <div className="text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Cuenta señalada</p>
              {r.targetUserId ? (
                <p className="mt-1">
                  <Link href={`/admin/users/${r.targetUserId}`} className="font-medium text-amber-700 hover:underline">
                    {r.targetName ?? r.targetUserId}
                  </Link>{" "}
                  <span className="text-gray-500">· {r.targetEmail}</span>
                </p>
              ) : (
                <p className="mt-1 text-gray-500">{r.kind === "suggestion" || r.kind === "complaint" ? "No aplica" : "Sin identificar"}</p>
              )}
              {r.targetLabel && <p className="text-xs text-gray-400">Escribió: “{r.targetLabel}”</p>}
              {r.listingTitle && (
                <p className="text-xs text-gray-500">
                  Anuncio:{" "}
                  {r.listingSlug ? (
                    <a href={`/listings/${r.listingSlug}`} target="_blank" rel="noreferrer" className="underline">
                      {r.listingTitle}
                    </a>
                  ) : (
                    r.listingTitle
                  )}
                </p>
              )}
              {r.bookingId && <p className="text-xs text-gray-400">Reserva: {r.bookingId}</p>}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Mensaje</p>
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800">{r.message}</p>
          </div>

          {r.kind !== "suggestion" && (
            <label className="block text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Vincular a la cuenta (correo)</span>
              <div className="mt-1 flex gap-2">
                <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="correo@ejemplo.com" className={`${sel} flex-1`} />
                <button
                  type="button"
                  disabled={busy || target === (r.targetEmail ?? "")}
                  onClick={() => void save({ targetEmail: target })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 disabled:opacity-40"
                >
                  Vincular
                </button>
              </div>
            </label>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Nota interna (solo admins)</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={`${sel} mt-1 w-full`} />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Respuesta al usuario (la verá y le avisamos)</span>
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} className={`${sel} mt-1 w-full`} />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save({ adminNote: note, adminReply: reply })}
              className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"
            >
              Guardar nota y respuesta
            </button>
            <span className="mx-1 text-gray-300">|</span>
            {(["in_review", "resolved", "dismissed", "open"] as UserReportStatus[])
              .filter((s) => s !== r.status)
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => void save({ status: s, adminNote: note, adminReply: reply })}
                  className={`rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-40 ${
                    s === "resolved"
                      ? "bg-green-600 text-white"
                      : s === "dismissed"
                        ? "border border-gray-300 text-gray-600"
                        : s === "in_review"
                          ? "bg-amber-500 text-white"
                          : "border border-red-300 text-red-700"
                  }`}
                >
                  {s === "open" ? "Reabrir" : `Marcar: ${REPORT_STATUS_LABEL[s]}`}
                </button>
              ))}
            {msg && <span className="text-xs text-gray-500">{msg}</span>}
          </div>
        </div>
      )}
    </li>
  );
}

export default function AdminReportsPage() {
  const [rows, setRows] = useState<AdminReportRow[] | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"" | UserReportKind>("");
  const [status, setStatus] = useState<"" | "pending" | UserReportStatus>("pending");
  const [mode, setMode] = useState<"" | "guest" | "host">("");

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/reports")
      .then((res) => res.json())
      .catch(() => ({}))
      .then((j: { reports?: AdminReportRow[] }) => {
        if (alive) setRows(Array.isArray(j.reports) ? j.reports : []);
      });
    return () => {
      alive = false;
    };
  }, [version]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (kind && r.kind !== kind) return false;
      if (status === "pending" && r.status !== "open" && r.status !== "in_review") return false;
      if (status && status !== "pending" && r.status !== status) return false;
      if (mode && r.reporterMode !== mode) return false;
      if (!needle) return true;
      return [r.message, r.reporterName, r.reporterEmail, r.targetName, r.targetEmail, r.targetLabel, r.listingTitle, r.category]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle));
    });
  }, [rows, q, kind, status, mode]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows ?? []) if (r.status === "open" || r.status === "in_review") c[r.kind] = (c[r.kind] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">Reportes y sugerencias</h1>
      <p className="mt-1 mb-6 text-sm text-gray-500">
        Denuncias de cuentas, reclamos de cuenta, quejas y sugerencias que mandan huéspedes y anfitriones.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {REPORT_KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            onClick={() => setKind(kind === k.kind ? "" : k.kind)}
            className={`rounded-xl border p-3 text-left transition-colors ${kind === k.kind ? "border-amber-500 bg-amber-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
          >
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className="text-xl font-bold text-gray-900">{counts[k.kind] ?? 0}</p>
            <p className="text-[10px] text-gray-400">pendientes</p>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por texto, persona, correo o anuncio…"
          className="min-w-[240px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={sel}>
          <option value="pending">Pendientes</option>
          <option value="">Todos los estados</option>
          <option value="open">Recibidos</option>
          <option value="in_review">En revisión</option>
          <option value="resolved">Resueltos</option>
          <option value="dismissed">Cerrados sin acción</option>
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={sel}>
          <option value="">Todos los tipos</option>
          {REPORT_KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </select>
        <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={sel}>
          <option value="">Huéspedes y anfitriones</option>
          <option value="guest">Enviados por huéspedes</option>
          <option value="host">Enviados por anfitriones</option>
        </select>
      </div>

      {rows === null ? (
        <p className="animate-pulse text-gray-400">Cargando…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-gray-400">{rows.length === 0 ? "Todavía nadie ha enviado nada." : "Nada coincide con los filtros."}</p>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <ReportCard key={`${r.id}:${r.updatedAt}`} r={r} onSaved={reload} />
          ))}
        </ul>
      )}
    </div>
  );
}
