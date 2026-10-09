"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";

type Appeal = {
  id: string;
  userName: string;
  userEmail: string;
  message: string;
  status: "pending" | "restored" | "upheld";
  createdAt: string;
  stillSuspended: boolean;
  suspendReason: string;
};

export function AppealsDesk() {
  const t = useT();
  const [rows, setRows] = useState<Appeal[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    fetch("/api/centro/appeals", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((j: { appeals?: Appeal[] }) => setRows(j.appeals ?? []))
      .catch(() => setError(t("No tienes acceso a esta sección.")));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, action: "restore" | "uphold") {
    setBusy(id);
    setError("");
    const res = await fetch("/api/centro/appeals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    }).catch(() => null);
    setBusy("");
    if (!res?.ok) {
      const j = (await res?.json().catch(() => ({}))) as { error?: string };
      setError(j.error ? t(j.error) : t("No se pudo guardar."));
      return;
    }
    load();
  }

  const pending = (rows ?? []).filter((r) => r.status === "pending");
  const done = (rows ?? []).filter((r) => r.status !== "pending");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">{t("Resoluciones de cuentas")}</h1>
      <p className="text-sm text-gray-500">
        {t("Si habilitas la cuenta, la persona puede volver a entrar. Si no, sigue suspendida. Los anuncios no se vuelven a publicar solos.")}
      </p>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {rows === null ? (
        <p className="text-sm text-gray-400">{t("Cargando…")}</p>
      ) : pending.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">{t("No hay solicitudes.")}</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((r) => (
            <li key={r.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900">{r.userName}</p>
              <p className="text-xs text-gray-500">{r.userEmail}</p>
              {r.suspendReason && <p className="mt-2 text-xs text-gray-500">{r.suspendReason}</p>}
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{r.message}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => void decide(r.id, "restore")}
                  className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {t("Habilitar cuenta")}
                </button>
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => void decide(r.id, "uphold")}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
                >
                  {t("Dejar suspendida")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">{t("Ya resueltas")}</h2>
          <ul className="space-y-2">
            {done.slice(0, 20).map((r) => (
              <li key={r.id} className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-sm text-gray-600">
                {r.userName} · {r.status === "restored" ? t("Cuenta habilitada.") : t("La cuenta sigue suspendida.")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
