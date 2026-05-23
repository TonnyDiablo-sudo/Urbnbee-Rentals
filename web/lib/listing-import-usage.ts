/** Token usage and rough USD estimate for one OpenAI call in listing import. */
export type ListingImportActionUsage = {
  action: "extract_listing_data" | "extract_photo_regions";
  label: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedUsd: number;
};

export type ListingImportUsageSummary = {
  actions: ListingImportActionUsage[];
  totals: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedUsd: number;
  };
};

export function emptyUsageSummary(): ListingImportUsageSummary {
  return {
    actions: [],
    totals: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedUsd: 0 },
  };
}

export function mergeUsage(
  a: ListingImportUsageSummary,
  b: ListingImportUsageSummary
): ListingImportUsageSummary {
  const actions = [...a.actions, ...b.actions];
  return {
    actions,
    totals: {
      promptTokens: a.totals.promptTokens + b.totals.promptTokens,
      completionTokens: a.totals.completionTokens + b.totals.completionTokens,
      totalTokens: a.totals.totalTokens + b.totals.totalTokens,
      estimatedUsd: roundUsd(a.totals.estimatedUsd + b.totals.estimatedUsd),
    },
  };
}

export function actionUsageFromOpenAi(opts: {
  action: ListingImportActionUsage["action"];
  label: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}): ListingImportActionUsage {
  const promptTokens = Math.max(0, opts.promptTokens);
  const completionTokens = Math.max(0, opts.completionTokens);
  const totalTokens = promptTokens + completionTokens;
  return {
    action: opts.action,
    label: opts.label,
    model: opts.model,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedUsd: estimateOpenAiCostUsd(opts.model, promptTokens, completionTokens),
  };
}

export function appendAction(
  summary: ListingImportUsageSummary,
  action: ListingImportActionUsage
): ListingImportUsageSummary {
  const actions = [...summary.actions, action];
  return {
    actions,
    totals: {
      promptTokens: summary.totals.promptTokens + action.promptTokens,
      completionTokens: summary.totals.completionTokens + action.completionTokens,
      totalTokens: summary.totals.totalTokens + action.totalTokens,
      estimatedUsd: roundUsd(summary.totals.estimatedUsd + action.estimatedUsd),
    },
  };
}

function roundUsd(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/** Rough list prices (USD per 1M tokens). Override via env for other models. */
export function estimateOpenAiCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const m = model.toLowerCase();
  let inputPer1M = Number(process.env.LISTING_IMPORT_INPUT_USD_PER_1M);
  let outputPer1M = Number(process.env.LISTING_IMPORT_OUTPUT_USD_PER_1M);
  if (!Number.isFinite(inputPer1M)) {
    if (m.includes("gpt-4o") && !m.includes("mini")) {
      inputPer1M = 2.5;
      outputPer1M = 10;
    } else {
      inputPer1M = 0.15;
      outputPer1M = 0.6;
    }
  }
  if (!Number.isFinite(outputPer1M)) outputPer1M = 0.6;
  const usd =
    (promptTokens / 1_000_000) * inputPer1M + (completionTokens / 1_000_000) * outputPer1M;
  return roundUsd(usd);
}

export function formatUsd(usd: number): string {
  if (usd < 0.01) return `~$${usd.toFixed(4)} USD`;
  return `~$${usd.toFixed(3)} USD`;
}
