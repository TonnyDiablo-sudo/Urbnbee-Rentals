"use client";

import { useT } from "@/components/i18n-provider";

/** Aviso bajo la reseña propia cuando todavía no está publicada. */
export function ReviewStatusNote({
  status,
  reason,
  className = "",
}: {
  status?: string;
  reason?: string;
  className?: string;
}) {
  const t = useT();
  if (status === "pending") {
    return (
      <p className={`rounded-lg bg-[#fdf6d8] px-3 py-2 text-xs text-[#5c4a0a] ${className}`}>
        {t("Tu reseña está siendo revisada por nuestro equipo. Se publicará en cuanto quede aprobada.")}
      </p>
    );
  }
  if (status === "rejected") {
    return (
      <p className={`rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800 ${className}`}>
        {t("Nuestro equipo no pudo publicar tu reseña.")} {reason ? t(reason) : ""} {t("Puedes escribirla de nuevo.")}
      </p>
    );
  }
  return null;
}
