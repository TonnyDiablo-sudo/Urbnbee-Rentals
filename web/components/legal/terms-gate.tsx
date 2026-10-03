"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";

type Pending = { version: string };

/**
 * Quien tiene sesión y no ha aceptado la versión vigente de los Términos (cuentas reclamadas,
 * activadas o anteriores a los Términos) debe aceptarlos antes de seguir.
 */
export function TermsGate() {
  const t = useT();
  const pathname = usePathname();
  const [pending, setPending] = useState<Pending | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/session", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const u = d?.user;
        setPending(u && !u.termsAccepted && typeof u.termsVersion === "string" ? { version: u.termsVersion } : null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  if (!pending) return null;

  async function accept() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/accept-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accept: true, version: pending.version }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(typeof d.error === "string" ? d.error : "No se pudo guardar. Intenta de nuevo.");
        return;
      }
      setPending(null);
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const reading = /\/terminos\/?$/.test(pathname ?? "");

  const form = (
    <>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-snug text-[#222]">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#222]"
        />
        <span>
          {t(
            "Leí y acepto los Términos y condiciones. Entiendo que Cabibee es una plataforma que conecta a anfitriones y huéspedes, que no es parte de nuestros contratos, chats ni tratos, y que cualquier controversia es entre las partes."
          )}
        </span>
      </label>
      {error && <p className="mt-2 text-sm text-red-700">{t(error)}</p>}
      <button
        type="button"
        disabled={!checked || busy}
        onClick={accept}
        className="mt-4 w-full rounded-xl bg-[#dcb81e] py-3 text-[15px] font-semibold text-black disabled:opacity-50"
      >
        {busy ? t("Un momento…") : t("Aceptar y continuar")}
      </button>
    </>
  );

  if (reading) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[200] border-t border-[#e5e5e5] bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
        <div className="mx-auto max-w-xl">{form}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-2xl">
        <h2 className="text-xl font-bold text-[#222]">{t("Términos y condiciones de uso")}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#555]">
          {t("Para seguir usando Cabibee necesitamos que leas y aceptes los Términos y condiciones de uso. Lo más importante:")}
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[#444]">
          <li>{t("Cabibee es una herramienta: no es arrendador, agente ni parte de las rentas.")}</li>
          <li>{t("Los contratos, pagos directos, chats y tratos son entre anfitrión y huésped.")}</li>
          <li>{t("El anfitrión es responsable de sus anuncios, permisos, impuestos y contratos.")}</li>
          <li>{t("Las etiquetas de verificación ayudan, pero no garantizan la conducta de nadie.")}</li>
        </ul>
        <Link href="/terminos" className="mt-3 inline-block text-sm font-semibold text-[#222] underline">
          {t("Leer los Términos completos")}
        </Link>
        <div className="mt-5">{form}</div>
      </div>
    </div>
  );
}
