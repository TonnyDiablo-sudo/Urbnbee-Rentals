"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconHome } from "../_components/icons";

export function BecomeHost({ name }: { name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upgrade = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/upgrade-to-host", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "No se pudo activar el modo anfitrión.");
        return;
      }
      router.refresh();
    } catch {
      setErr("Sin conexión.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-6 py-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fdf6d8] text-[#b8931a]">
        <IconHome />
      </div>
      <h2 className="mt-5 text-2xl font-bold text-[#222]">{name ? `${name.split(" ")[0]}, ` : ""}¿listo para hospedar?</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-[#555]">
        Tu cuenta de huésped se vuelve también de anfitrión. No pierdes tus viajes ni tu membresía: puedes cambiar de
        modo cuando quieras.
      </p>
      <ul className="mt-5 space-y-2.5 text-sm text-[#333]">
        <li>• Publicar anuncios es gratis.</li>
        <li>• El chat con huéspedes por la web es gratis.</li>
        <li>• Para recibir reservas pagadas activas el motor de reservas.</li>
      </ul>
      {err && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void upgrade()}
        className="mt-8 w-full rounded-xl bg-[#dcb81e] py-3.5 text-[15px] font-semibold text-black disabled:opacity-60"
      >
        {busy ? "Activando…" : "Activar modo anfitrión"}
      </button>
      <Link href="/" className="mt-3 block py-3 text-center text-sm font-medium text-[#717171] underline">
        Ahora no, seguir explorando
      </Link>
    </div>
  );
}
