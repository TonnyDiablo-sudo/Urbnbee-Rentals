"use client";

import { useState } from "react";
import { useT } from "@/components/i18n-provider";

export function OptOutButton({ token, done: initialDone }: { token: string; done: boolean }) {
  const t = useT();
  const [done, setDone] = useState(initialDone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (done) {
    return (
      <p className="mt-6 rounded-xl bg-green-50 p-4 text-sm text-green-800">
        {t("Listo: tus anuncios ya no se ven en Cabibee y no te volveremos a escribir.")}
      </p>
    );
  }

  async function confirm() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/baja", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) setDone(true);
    else setError(t("No se pudo. Intenta otra vez."));
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={confirm}
        disabled={busy}
        className="w-full rounded-xl bg-[#484848] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? t("Quitando…") : t("Sí, quitar mis anuncios")}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
