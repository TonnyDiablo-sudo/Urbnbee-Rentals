"use client";

import { useT } from "@/components/i18n-provider";
import { LONG_STAY_MONTHS, longStayNights, type LongStayMonths } from "@/lib/listing-pricing";

/** Descuentos opcionales de 3, 6 y 12 meses; resaltados cuando el anuncio es de renta mensual. */
export function LongStayDiscountFields({
  values,
  onChange,
  onBlur,
  highlight = false,
  inputClassName,
}: {
  values: Record<LongStayMonths, string>;
  onChange: (months: LongStayMonths, value: string) => void;
  onBlur?: () => void;
  highlight?: boolean;
  inputClassName: string;
}) {
  const t = useT();
  return (
    <div
      className={`rounded-2xl border p-4 ${highlight ? "border-[#dcb81e] bg-[#fdf6d8]" : "border-[#e5e5e5]"}`}
    >
      <p className="text-[15px] font-semibold text-[#222]">{t("Descuentos por estancias largas (opcional)")}</p>
      <p className="mt-1 text-xs text-[#717171]">
        {highlight
          ? t("Premia a quien renta varios meses. Cada mes cuenta como 30 noches.")
          : t("Para estancias de varios meses. Cada mes cuenta como 30 noches.")}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {LONG_STAY_MONTHS.map((m) => (
          <label key={m} className="block min-w-0 text-sm font-semibold text-[#222]">
            {t("{n} meses", { n: m })}
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={90}
                placeholder="0"
                value={values[m]}
                onChange={(e) => onChange(m, e.target.value)}
                onBlur={onBlur}
                className={`${inputClassName} pr-8`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-[#717171]">%</span>
            </div>
            <span className="mt-1 block text-xs font-normal text-[#717171]">
              {t("{n}+ noches", { n: longStayNights(m) })}
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-[#717171]">
        {t("No se acumulan con el descuento semanal o mensual: el huésped recibe sólo el mayor que le aplique (máximo 90%).")}
      </p>
    </div>
  );
}
