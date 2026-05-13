"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BookingTokenLookup() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const digits = code.replace(/\D/g, "").slice(0, 6);

  return (
    <div className="mx-auto max-w-xl px-4 pb-12 text-center">
      <h2 className="text-xl font-normal text-[#000]">¿Ya tienes un código de reserva?</h2>
      <p className="mt-2 text-sm text-[#888]">
        Ingresa los 6 dígitos que recibiste al solicitar o cuando el anfitrión aprobó tu estancia.
      </p>
      <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="000000"
          value={digits}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="rounded border px-4 py-3 text-center font-mono text-lg tracking-[0.35em] text-[#484848]"
          style={{ borderColor: "#ebebeb" }}
          aria-label="Código de 6 dígitos"
        />
        <button
          type="button"
          disabled={busy || digits.length !== 6}
          onClick={async () => {
            setErr(null);
            setBusy(true);
            try {
              const res = await fetch(`/api/bookings/lookup?token=${encodeURIComponent(digits)}`);
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                setErr(typeof data.error === "string" ? data.error : "No encontrado.");
                return;
              }
              router.push(`/finish/${digits}`);
            } catch {
              setErr("Error de red.");
            } finally {
              setBusy(false);
            }
          }}
          className="rounded px-8 py-3 text-sm font-semibold text-black transition hover:brightness-90 disabled:opacity-50"
          style={{ backgroundColor: "#dcb81e" }}
        >
          {busy ? "Buscando…" : "Consultar"}
        </button>
      </div>
      {err && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
