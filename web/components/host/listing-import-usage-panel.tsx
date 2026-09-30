"use client";

import { formatUsd, type ListingImportUsageSummary } from "@/lib/listing-import-usage";
import { useT } from "@/components/i18n-provider";

export function ListingImportUsagePanel({ usage }: { usage: ListingImportUsageSummary }) {
  const t = useT();
  if (!usage.actions.length) return null;

  return (
    <div className="rounded-lg border border-[#e8e0c8] bg-amber-50/50 p-4 text-sm text-[#484848]">
      <p className="font-semibold">{t("Uso de IA en esta importación")}</p>
      <p className="mt-1 text-xs text-[#666]">
        {t("Estimación según tokens reportados por OpenAI (solo lectura de capturas, sin recorte de fotos).")}
      </p>
      <ul className="mt-3 space-y-2">
        {usage.actions.map((a) => (
          <li
            key={a.action}
            className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#eee] pb-2 last:border-0"
          >
            <span>{t(a.label)}</span>
            <span className="text-xs text-[#666]">
              {t("{input} entrada + {output} salida =", {
                input: a.promptTokens.toLocaleString(),
                output: a.completionTokens.toLocaleString(),
              })}{" "}
              <strong>{t("{n} tokens", { n: a.totalTokens.toLocaleString() })}</strong> · {formatUsd(a.estimatedUsd)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs font-medium text-[#484848]">
        {t("Total: {n} tokens", { n: usage.totals.totalTokens.toLocaleString() })} ·{" "}
        {formatUsd(usage.totals.estimatedUsd)}
      </p>
    </div>
  );
}
