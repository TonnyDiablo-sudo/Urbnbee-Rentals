"use client";

import { useState } from "react";

export function ConnectClient({
  returnUrl,
  state,
}: {
  returnUrl: string;
  state: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
      <h1 className="text-2xl font-semibold text-[#484848]">Conectar urbnbeeai</h1>
      <p className="text-sm leading-relaxed text-[#555]">
        urbnbeeai quiere ver tus anuncios, disponibilidad y reservas para que tu agente IA
        atienda a tus huéspedes. La contraseña se queda en Cabibee.
      </p>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              const res = await fetch("/api/host/integrations/beeagent/connect", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ returnUrl, state }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                setErr(typeof data.error === "string" ? data.error : "No se pudo conectar.");
                return;
              }
              if (typeof data.redirectUrl === "string" && data.redirectUrl.startsWith("http")) {
                window.location.assign(data.redirectUrl);
                return;
              }
              setErr("Respuesta incompleta.");
            } catch {
              setErr("Error de red.");
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-60"
          style={{ backgroundColor: "#dcb81e" }}
        >
          {busy ? "Conectando…" : "Permitir"}
        </button>
        <a
          href="/host/settings/integrations"
          className="rounded-full border border-[#ddd] px-5 py-2.5 text-center text-sm font-semibold text-[#484848]"
        >
          Cancelar
        </a>
      </div>
    </div>
  );
}
