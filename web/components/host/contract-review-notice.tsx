"use client";

import { useT } from "@/components/i18n-provider";
import { contractJurisdiction } from "@/lib/contract-jurisdiction";

type Place = { country?: string; state?: string; city?: string; county?: string };

/** Aviso de que el contrato es entre particulares y que el anfitrión debe revisarlo. */
export function ContractReviewNotice({
  listing,
  reviewed,
  onReviewed,
}: {
  listing: Place;
  reviewed: boolean;
  onReviewed: (v: boolean) => void;
}) {
  const t = useT();
  const j = contractJurisdiction({
    country: listing.country,
    state: listing.state,
    city: listing.city,
    municipality: listing.county,
  });
  const missingState = !(listing.state ?? "").trim();

  return (
    <div className="rounded-xl border border-[#f0d77a] bg-[#fffaf0] p-4 text-sm leading-relaxed text-[#5c4a0e]">
      <p className="font-semibold text-[#3d3108]">{t("Revisa tu contrato antes de usarlo")}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>{t("Es un contrato entre tú y tu huésped. Tú eres responsable de su contenido y de cumplirlo.")}</li>
        <li>
          {t("Se adapta al lugar de tu anuncio: {place}. Ley aplicable: {law}", {
            place: j.label,
            law: j.governingLaw,
          })}
        </li>
        <li>
          {t(
            "Es una plantilla general, no asesoría legal. Las leyes, permisos e impuestos de hospedaje cambian por estado y municipio; confírmalo con un abogado o con tu municipio."
          )}
        </li>
        <li>{t("Puedes cambiar el machote, la cancelación y agregar tus propias cláusulas según tus necesidades.")}</li>
        <li>{t("Abre la vista previa y lee el contrato completo.")}</li>
      </ul>
      {missingState && (
        <p className="mt-2 font-medium text-[#a14b00]">
          {t("Tu anuncio no tiene estado o provincia: agrégalo en Ubicación para que el contrato cite la ley correcta.")}
        </p>
      )}
      <label className="mt-3 flex items-start gap-2 font-medium text-[#3d3108]">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#dcb81e]"
          checked={reviewed}
          onChange={(e) => onReviewed(e.target.checked)}
        />
        {t(
          "Leí el contrato completo y acepto que es un contrato entre mis huéspedes y yo: yo soy responsable de su contenido y de cumplirlo. Cabibee sólo me da la herramienta para prepararlo y firmarlo, y no es parte del contrato."
        )}
      </label>
    </div>
  );
}
