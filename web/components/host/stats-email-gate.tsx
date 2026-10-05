"use client";

import { VerifyEmailBox } from "@/components/account/purchase-prereqs";
import { useT } from "@/components/i18n-provider";

/** Las estadísticas se ven sólo con el correo confirmado. */
export function StatsEmailGate({ email, placeholder }: { email?: string; placeholder?: boolean }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#e5e5e5] bg-white p-5">
        <p className="text-[17px] font-semibold text-[#222]">{t("Confirma tu correo para ver tus estadísticas")}</p>
        <p className="mt-1 text-sm text-[#717171]">
          {t("Vistas, contactos y sugerencias de tus anuncios aparecen aquí en cuanto confirmes tu correo. Así sabemos que la cuenta es tuya.")}
        </p>
      </div>
      <VerifyEmailBox email={email} placeholder={placeholder} />
    </div>
  );
}
