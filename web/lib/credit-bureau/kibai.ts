import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import type { BureauDecision, BureauResult, BureauStart, CreditBureauProvider } from "@/lib/credit-bureau/types";

/**
 * Contrato HTTP de Kibai. Las rutas y nombres de campos se ajustan aquí cuando llegue su documentación;
 * el resto de Cabibee solo usa la interfaz CreditBureauProvider.
 */
const TIMEOUT_MS = 20_000;
const WEBHOOK_MAX_AGE_S = 300;

type KibaiConfig = { baseUrl: string; apiKey: string; webhookSecret: string };

export function kibaiConfig(): KibaiConfig | null {
  const baseUrl = process.env.KIBAI_API_URL?.trim().replace(/\/$/, "");
  const apiKey = process.env.KIBAI_API_KEY?.trim();
  const webhookSecret = process.env.KIBAI_WEBHOOK_SECRET?.trim();
  if (!baseUrl?.startsWith("https://") || !apiKey || !webhookSecret) return null;
  return { baseUrl, apiKey, webhookSecret };
}

async function kibaiFetch(cfg: KibaiConfig, path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Kibai ${res.status} en ${path}`);
  }
  return data;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function decisionOf(v: unknown): BureauDecision | undefined {
  return v === "approve" || v === "review" || v === "decline" ? v : undefined;
}

export function kibaiProvider(cfg: KibaiConfig): CreditBureauProvider {
  return {
    id: "kibai",

    async start(applicant, urls): Promise<BureauStart> {
      const data = await kibaiFetch(cfg, "/v1/applications", {
        method: "POST",
        body: JSON.stringify({
          reference: applicant.reference,
          name: applicant.fullName,
          email: applicant.email,
          report_type: "ordinary",
          callback_url: urls.callbackUrl,
          return_url: urls.returnUrl,
        }),
      });
      const ref = str(data.id);
      if (!ref) throw new Error("Kibai no devolvió id de solicitud.");
      const formUrl = str(data.form_url);
      return { ref, formUrl: formUrl?.startsWith("https://") ? formUrl : undefined };
    },

    async fetchResult(ref): Promise<BureauResult> {
      const data = await kibaiFetch(cfg, `/v1/applications/${encodeURIComponent(ref)}`);
      const status = str(data.status);
      if (status === "completed") {
        const score = typeof data.score === "number" && Number.isFinite(data.score) ? data.score : undefined;
        return {
          state: "done",
          score,
          decision: decisionOf(data.decision),
          noHistory: data.no_history === true,
        };
      }
      if (status === "failed" || status === "rejected" || status === "expired") {
        return { state: "failed", reason: str(data.error) ?? status };
      }
      return { state: "pending" };
    },

    verifyWebhook(raw, headers) {
      const header = headers.get("x-kibai-signature") ?? "";
      const parts = Object.fromEntries(
        header.split(",").map((p) => {
          const [k, ...v] = p.trim().split("=");
          return [k, v.join("=")];
        })
      );
      const ts = Number(parts.t);
      const sig = parts.v1;
      if (!Number.isFinite(ts) || !sig) return null;
      if (Math.abs(Date.now() / 1000 - ts) > WEBHOOK_MAX_AGE_S) return null;
      const expected = createHmac("sha256", cfg.webhookSecret).update(`${ts}.${raw}`).digest("hex");
      const a = Buffer.from(expected, "hex");
      const b = Buffer.from(sig, "hex");
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
      try {
        const body = JSON.parse(raw) as Record<string, unknown>;
        const ref = str(body.application_id) ?? str(body.id);
        return ref ? { ref } : null;
      } catch {
        return null;
      }
    },
  };
}
