export type BureauApplicant = {
  /** Nuestro id de screening; el proveedor lo regresa tal cual. */
  reference: string;
  fullName: string;
  email: string;
};

export type BureauStart = {
  ref: string;
  /** Liga donde el titular captura sus datos y autoriza con su NIP. */
  formUrl?: string;
};

export type BureauDecision = "approve" | "review" | "decline";

export type BureauResult =
  | { state: "pending" }
  | { state: "done"; score?: number; decision?: BureauDecision; noHistory?: boolean }
  | { state: "failed"; reason: string };

export interface CreditBureauProvider {
  id: "kibai";
  start(applicant: BureauApplicant, urls: { callbackUrl: string; returnUrl: string }): Promise<BureauStart>;
  fetchResult(ref: string): Promise<BureauResult>;
  /** Devuelve la referencia solo si la firma es válida y reciente. */
  verifyWebhook(raw: string, headers: Headers): { ref: string } | null;
}
