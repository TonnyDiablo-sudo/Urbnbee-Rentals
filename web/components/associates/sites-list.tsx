"use client";

import { useT } from "@/components/i18n-provider";
import { LISTING_SITES } from "@/lib/associate-link-utils";

/** Qué sitios lee Cabibee con el puro link y en cuáles hacen falta capturas. */
export function SitesList({ compact }: { compact?: boolean }) {
  const t = useT();
  const link = LISTING_SITES.filter((s) => s.mode === "link");
  const shots = LISTING_SITES.filter((s) => s.mode === "shots");
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${compact ? "text-xs" : "text-sm"}`}>
      <div className="rounded-lg border border-green-200 bg-green-50 p-3">
        <p className="font-semibold text-green-900">✅ {t("Con el puro link")}</p>
        <p className="mt-0.5 text-xs text-green-800">{t("Pega el link y toca Analizar: Cabibee lee el texto y las fotos.")}</p>
        <ul className="mt-2 space-y-0.5 text-green-900">
          {link.map((s) => (
            <li key={s.name}>• {s.name}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="font-semibold text-amber-900">📸 {t("Con capturas, texto o la extensión")}</p>
        <p className="mt-0.5 text-xs text-amber-800">
          {t("Bloquean a Cabibee: pega el link como referencia y agrega capturas o el texto. En computadora, la extensión de Chrome funciona en todos.")}
        </p>
        <ul className="mt-2 space-y-0.5 text-amber-900">
          {shots.map((s) => (
            <li key={s.name}>• {s.name}</li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-gray-500 sm:col-span-2">
        {t("¿Otro sitio? Prueba con el link; si no se puede leer, Cabibee te pide capturas.")}
      </p>
    </div>
  );
}
