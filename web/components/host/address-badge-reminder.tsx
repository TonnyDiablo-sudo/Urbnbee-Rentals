"use client";

import Link from "next/link";
import { useT } from "@/components/i18n-provider";

/** Aviso fijo mientras algún anuncio con motor no tenga la dirección verificada: no bloquea reservas, sólo quita el listón. */
export function AddressBadgeReminder({ count, href }: { count: number; href: string }) {
  const t = useT();
  if (count <= 0) return null;
  return (
    <Link href={href} className="block rounded-2xl border border-[#f0d77a] bg-[#fdf6d8] px-4 py-3 text-[#5c4a0a]">
      <p className="text-[15px] font-semibold">
        📍 {count === 1 ? t("Verifica la dirección de tu anuncio") : t("Verifica la dirección de {n} anuncios", { n: count })}
      </p>
      <p className="mt-0.5 text-sm leading-relaxed">
        {t("Sube un recibo a tu nombre con la dirección del anuncio. Con él aparece el listón «Ubicación verificada», que le da más seguridad y confianza a quien reserva. Mientras tanto sí recibes reservas.")}
      </p>
    </Link>
  );
}
