"use client";

import { formatUsd, type ListingImportUsageSummary } from "@/lib/listing-import-usage";

export function ListingImportUsagePanel({
  usage,
  photosExtracted,
  extractPhotos,
}: {
  usage: ListingImportUsageSummary;
  photosExtracted?: number;
  extractPhotos?: boolean;
}) {
  if (!usage.actions.length) return null;

  return (
    <div className="rounded-lg border border-[#e8e0c8] bg-amber-50/50 p-4 text-sm text-[#484848]">
      <p className="font-semibold">Uso de IA en esta importación</p>
      <p className="mt-1 text-xs text-[#666]">
        Estimación aproximada según tokens reportados por OpenAI (no incluye cargo fijo de Railway).
      </p>
      <ul className="mt-3 space-y-2">
        {usage.actions.map((a) => (
          <li key={a.action} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#eee] pb-2 last:border-0">
            <span>{a.label}</span>
            <span className="text-xs text-[#666]">
              {a.promptTokens.toLocaleString()} entrada + {a.completionTokens.toLocaleString()} salida ={" "}
              <strong>{a.totalTokens.toLocaleString()} tokens</strong> · {formatUsd(a.estimatedUsd)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs font-medium text-[#484848]">
        Total: {usage.totals.totalTokens.toLocaleString()} tokens · {formatUsd(usage.totals.estimatedUsd)}
      </p>
      {extractPhotos && (
        <p className="mt-2 text-xs text-[#666]">
          Fotos recortadas en galería: <strong>{photosExtracted ?? 0}</strong> (revisa y borra las que no sirvan).
        </p>
      )}
    </div>
  );
}
