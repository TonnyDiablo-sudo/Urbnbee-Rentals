"use client";

import { useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

export function TokenPanel() {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => ""
  );

  async function generate() {
    if (!confirm("Si ya tenías un token, dejará de funcionar. ¿Generar uno nuevo?")) return;
    setBusy(true);
    const res = await fetch("/api/associate/token", { method: "POST" }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (res?.ok && typeof j.token === "string") setToken(j.token);
  }

  function copy(label: string, value: string) {
    void navigator.clipboard.writeText(value);
    setCopied(label);
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
      <div>
        <p className="text-xs text-gray-500">Dirección de Cabibee</p>
        <div className="mt-1 flex gap-2">
          <code className="flex-1 rounded bg-gray-100 px-3 py-2 text-sm">{origin}</code>
          <button type="button" onClick={() => copy("origin", origin)} className="rounded-lg border border-gray-300 px-3 text-sm">
            {copied === "origin" ? "✓" : "Copiar"}
          </button>
        </div>
      </div>
      {token ? (
        <div>
          <p className="text-xs text-gray-500">Tu token (solo se muestra ahora)</p>
          <div className="mt-1 flex gap-2">
            <code className="flex-1 break-all rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">{token}</code>
            <button type="button" onClick={() => copy("token", token)} className="rounded-lg border border-gray-300 px-3 text-sm">
              {copied === "token" ? "✓" : "Copiar"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void generate()}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
        >
          {busy ? "Generando…" : "Generar token"}
        </button>
      )}
    </div>
  );
}
