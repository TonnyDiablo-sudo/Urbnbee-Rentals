"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ClaimAdminPage() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function claim() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/claim-admin", {
        method: "POST",
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "No se pudo activar admin.");
        return;
      }
      setMsg("Listo. Redirigiendo al panel de administración…");
      router.push(typeof j.redirect === "string" ? j.redirect : "/admin/overview");
      router.refresh();
    } catch {
      setErr("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-md px-4 py-24" style={{ paddingTop: 96 }}>
        <h1 className="text-xl font-semibold text-[#222]">Activar administrador</h1>
        <p className="mt-2 text-sm text-[#484848]">
          Solo funciona si en Railway existe <code className="text-xs">URBNBEE_ADMIN_EMAIL</code> con el mismo
          correo de tu sesión actual.
        </p>
        {err && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
        {msg && <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">{msg}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => void claim()}
          className="mt-6 w-full rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#222] disabled:opacity-50"
        >
          {busy ? "Activando…" : "Hacerme administrador"}
        </button>
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-[#484848] underline">
            Iniciar sesión con otra cuenta
          </Link>
        </p>
      </div>
    </>
  );
}

