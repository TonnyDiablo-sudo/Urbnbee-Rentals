"use client";

import { useState } from "react";
import { useT } from "@/components/i18n-provider";

const GENERAL_TIPS = [
  {
    title: "Tus datos y los del inmueble completos",
    text: "Nombre legal con el que firmas, tu domicilio y la dirección exacta de la propiedad. Un contrato con datos incompletos es difícil de hacer valer.",
  },
  {
    title: "Reglas de la casa por escrito",
    text: "Ruido, visitas, mascotas, fumar, fiestas y ocupación máxima. Si no está en el contrato, después es tu palabra contra la del huésped.",
  },
  {
    title: "Cancelación clara y con fechas",
    text: "Di cuánto devuelves y hasta cuándo. Evita frases como «según el caso»: los pleitos empiezan donde el contrato no es claro.",
  },
  {
    title: "Depósito con evidencia",
    text: "Si pides depósito, toma fotos o video al entregar y al recibir. Sólo descuenta daños que puedas comprobar y di en cuántos días lo devuelves.",
  },
  {
    title: "Firma antes de entregar llaves",
    text: "Que el huésped firme en Cabibee antes de llegar. Así queda constancia de fechas, montos y reglas.",
  },
  {
    title: "Permisos e impuestos al día",
    text: "El contrato dice que cuentas con los registros y pagas los impuestos de hospedaje de tu zona. Asegúrate de que sea cierto: es tu responsabilidad.",
  },
  {
    title: "Estancias de 30 noches o más",
    text: "En varios lugares de Estados Unidos y en algunos estados de México, una estancia larga puede dar derechos de inquilino y complicar un desalojo. Usa el machote de estancia media y revisa la ley local.",
  },
];

/** Cláusula que el anfitrión puede agregar y ajustar para estancias con mínimo legal de noches. */
export const MIN_STAY_CLAUSE = `ESTANCIA MÍNIMA, PAGOS Y TERMINACIÓN ANTICIPADA. La estancia es por el plazo completo indicado en este contrato, que cumple la estancia mínima que exige la normativa local. El huésped paga por adelantado el primer periodo, del [fecha] al [fecha], y el resto a más tardar el [fecha de evaluación]. En esa fecha las partes confirman si la estancia continúa. Si el huésped decide terminarla antes, deberá avisar por escrito con [__] días de anticipación y pagará una pena por terminación anticipada de $[____] MXN; las noches ya pagadas y no usadas se devuelven dentro de [__] días, salvo la pena.`;

/**
 * Consejos para armar un buen contrato, incluido el caso de las ciudades que exigen un mínimo de noches.
 * `onAddClause` agrega la cláusula de estancia mínima a las cláusulas del anfitrión.
 */
export function ContractTips({ onAddClause, hasClause }: { onAddClause?: (text: string) => void; hasClause?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [minOpen, setMinOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-[#e5e5e5] bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span>
          <span className="block text-[15px] font-semibold text-[#222]">💡 {t("Consejos y recomendaciones")}</span>
          <span className="block text-[13px] text-[#717171]">{t("Cómo hacer un contrato que te proteja")}</span>
        </span>
        <span className={`text-lg text-[#555] transition ${open ? "rotate-180" : ""}`} aria-hidden>
          ⌄
        </span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-[#eee] px-4 pb-4 pt-3">
          <ul className="space-y-3">
            {GENERAL_TIPS.map((tip) => (
              <li key={tip.title} className="text-sm leading-relaxed">
                <p className="font-semibold text-[#222]">{t(tip.title)}</p>
                <p className="text-[#555]">{t(tip.text)}</p>
              </li>
            ))}
          </ul>

          <div className="rounded-xl bg-[#f7f7f7] p-3.5">
            <button
              type="button"
              onClick={() => setMinOpen(!minOpen)}
              aria-expanded={minOpen}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="text-sm font-semibold text-[#222]">
                {t("¿Tu ciudad exige un mínimo de noches (por ejemplo 30)?")}
              </span>
              <span className={`text-[#555] transition ${minOpen ? "rotate-180" : ""}`} aria-hidden>
                ⌄
              </span>
            </button>
            {minOpen && (
              <div className="mt-2 space-y-2 text-sm leading-relaxed text-[#444]">
                <p>
                  {t(
                    "Algunas ciudades sólo permiten rentar por 30 noches o más. Una opción es hacer el contrato por el plazo mínimo completo, con una fecha de evaluación y una cláusula de terminación anticipada:"
                  )}
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>{t("El contrato es por el plazo completo (por ejemplo, un mes).")}</li>
                  <li>{t("El huésped paga por adelantado el primer periodo y el resto en la fecha de evaluación.")}</li>
                  <li>{t("En la fecha de evaluación ambos confirman si la estancia sigue.")}</li>
                  <li>{t("Si el huésped se va antes, paga una pena por terminación anticipada. Considérala en tu precio.")}</li>
                </ul>
                <p className="rounded-lg border border-[#f0d77a] bg-[#fffaf0] p-2.5 text-[13px] text-[#5c4a0e]">
                  {t(
                    "Ojo: si la pena es simbólica (por ejemplo $1) y en la práctica todos se van antes de las 30 noches, la autoridad puede tratarlo como renta corta disfrazada y multarte o quitarte el permiso. Usa una pena real y un plazo que de verdad ofreces, y confírmalo con un abogado o con tu municipio."
                  )}
                </p>
                {onAddClause && (
                  <button
                    type="button"
                    disabled={hasClause}
                    onClick={() => onAddClause(MIN_STAY_CLAUSE)}
                    className="w-full rounded-xl border border-[#222] bg-white py-2.5 text-sm font-semibold text-[#222] disabled:opacity-50"
                  >
                    {hasClause ? t("Cláusula agregada: llena los datos entre corchetes") : t("Agregar esta cláusula a mi contrato")}
                  </button>
                )}
              </div>
            )}
          </div>

          <p className="text-[13px] font-semibold text-[#a14b00]">
            {t("Recuerda siempre seguir las reglas locales de tu zona. Estos consejos no son asesoría legal.")}
          </p>
        </div>
      )}
    </div>
  );
}
