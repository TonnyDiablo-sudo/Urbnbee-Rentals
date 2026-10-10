import "server-only";
import { createHash } from "crypto";
import { kibaiConfig, kibaiProvider } from "@/lib/credit-bureau/kibai";
import type { BureauResult, CreditBureauProvider } from "@/lib/credit-bureau/types";
import type { ScreeningBand } from "@/lib/screening-types";

export type { BureauResult, CreditBureauProvider } from "@/lib/credit-bureau/types";

/** CREDIT_BUREAU_PROVIDER=kibai con sus llaves. Sin eso, el pago se cobra pero nadie consulta el buró. */
export function activeCreditBureau(): CreditBureauProvider | null {
  const id = process.env.CREDIT_BUREAU_PROVIDER?.trim().toLowerCase();
  if (id === "kibai") {
    const cfg = kibaiConfig();
    return cfg ? kibaiProvider(cfg) : null;
  }
  return null;
}

export function bureauRefHash(ref: string): string {
  return createHash("sha256").update(`credit-bureau:${ref}`).digest("hex");
}

const SCORE_APTO = 650;
const SCORE_REVISAR = 550;

/** Solo sale el resumen; el score y el reporte no se guardan. */
export function bandFromResult(result: Extract<BureauResult, { state: "done" }>): ScreeningBand {
  if (result.decision === "approve") return "apto";
  if (result.decision === "review") return "revisar";
  if (result.decision === "decline") return "no_recomendado";
  if (result.noHistory || result.score === undefined) return "revisar";
  if (result.score >= SCORE_APTO) return "apto";
  if (result.score >= SCORE_REVISAR) return "revisar";
  return "no_recomendado";
}
