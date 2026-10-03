"use client";

import { useState } from "react";
import { useT } from "@/components/i18n-provider";

/** Texto del contrato; si hay traducción automática se muestra primero, con opción de ver el original. */
export function ContractText({
  lines,
  translated,
  className,
}: {
  lines: string[];
  translated?: string[];
  className: string;
}) {
  const t = useT();
  const [original, setOriginal] = useState(false);
  const showTranslated = Boolean(translated?.length) && !original;
  return (
    <>
      {translated?.length ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f0f6ff] px-3 py-2 text-xs text-[#1d4f91]">
          <span>
            {showTranslated
              ? t("Traducción automática. El contrato que se firma es el original en español.")
              : t("Original en español (el que se firma).")}
          </span>
          <button type="button" onClick={() => setOriginal(!original)} className="font-semibold underline">
            {showTranslated ? t("Ver original") : t("Ver traducción")}
          </button>
        </div>
      ) : null}
      <pre className={className} style={{ borderColor: "#ebebeb" }}>
        {(showTranslated ? translated! : lines).join("\n")}
      </pre>
    </>
  );
}
