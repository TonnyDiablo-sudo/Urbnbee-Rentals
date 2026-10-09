import "server-only";
import { isAccountSuspended } from "@/lib/account-standing";
import { callListingImportOpenAiJson } from "@/lib/listing-import-openai";
import { findUserById, listListingsForHost, updateListing, updateUserAuth } from "@/lib/marketplace-store";
import { notifyUser } from "@/lib/push";
import { isStaffAccount } from "@/lib/staff";
import { findUserReport, listUserReports, updateUserReport } from "@/lib/user-reports-store";
import { reportReceipt, type UserReportRecord } from "@/lib/user-reports-types";

type Verdict = { decision: "suspend" | "keep"; reason: string; model: string };

/** Cuatro intentos, todos con el mismo modelo; si los cuatro fallan, lo revisa una persona. */
const WAIT_BEFORE_MS = [0, 3_000, 8_000, 15_000];

export function reportJudgeModel(): string {
  return process.env.REPORT_JUDGE_OPENAI_MODEL?.trim() || "gpt-6-astra";
}

const SYSTEM = `Eres quien revisa denuncias de cuentas en Cabibee, un marketplace de alojamiento.
Decides si la cuenta denunciada se suspende ya, solo con el cuestionario.
Suspende únicamente si el relato describe con claridad una de estas faltas: fraude o estafa, pedir pago fuera de la plataforma, anuncio falso, acoso o amenazas, suplantación, discriminación, o contenido sexual o violento.
No suspendas por un desacuerdo, una mala experiencia, un precio, una reseña, o si el relato es vago y no da hechos.
Responde solo JSON: {"decision":"suspend" o "keep","reason":"una frase corta en español para el equipo, sin nombrar que eres un modelo"}`;

async function judgeOnce(report: UserReportRecord, model: string): Promise<Verdict | null> {
  const answers = report.answers;
  if (!answers) return null;
  const result = await callListingImportOpenAiJson<{ decision?: string; reason?: string }>({
    model,
    reasoningEffort: "low",
    system: SYSTEM,
    userText: [
      `Motivo: ${report.category}`,
      `Dónde: ${answers.where}`,
      `¿Sigue pasando?: ${answers.ongoing}`,
      `Relato: ${report.message.slice(0, 2000)}`,
    ].join("\n"),
    maxTokens: 400,
    timeoutMs: 90_000,
  });
  if (!result.ok) return null;
  const decision = result.data.decision === "suspend" ? "suspend" : result.data.decision === "keep" ? "keep" : null;
  if (!decision) return null;
  const reason = typeof result.data.reason === "string" ? result.data.reason.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  return { decision, reason, model: result.model };
}

function applyVerdict(report: UserReportRecord, verdict: Verdict, attempts: number): void {
  const stamp = { aiModel: verdict.model, aiAt: new Date().toISOString(), aiAttempts: attempts };
  const target = report.targetUserId ? findUserById(report.targetUserId) : undefined;
  const canSuspend = Boolean(target) && target!.role !== "admin" && !isStaffAccount(target) && !isAccountSuspended(target);

  if (verdict.decision === "suspend" && canSuspend && target) {
    const reason = verdict.reason || "El reporte describe una falta a las reglas.";
    updateUserAuth(target.id, { suspendedAt: new Date().toISOString(), suspendReason: reason });
    for (const listing of listListingsForHost(target.id)) {
      if (listing.published) updateListing(listing.id, target.id, { published: false });
    }
    updateUserReport(report.id, { ...stamp, status: "resolved", adminNote: reason, aiDecision: "suspend", aiReason: reason });
    notifyUser(target.id, {
      kind: "support",
      title: "Tu cuenta fue suspendida",
      body: "Puedes pedir que la revisen desde la app. Si no la habilitan, sigue suspendida.",
      url: "/perfil",
      tag: "account-suspended",
    });
    notifyUser(report.reporterId, {
      kind: "support",
      title: "Reporte {receipt}",
      body: "Revisamos la cuenta que reportaste y tomamos medidas. Gracias por avisarnos.",
      vars: { receipt: reportReceipt(report.id) },
      url: "/reportar",
      tag: `report-${report.id}`,
    });
    return;
  }

  const note =
    verdict.decision === "suspend"
      ? `${verdict.reason || "Pidió suspender"} (no se aplicó: la cuenta ya estaba suspendida o está protegida).`
      : verdict.reason || "No hubo elementos suficientes para suspender.";
  updateUserReport(report.id, { ...stamp, status: "open", aiDecision: "keep", aiReason: note });
}

const inFlight = new Set<string>();

async function review(reportId: string): Promise<void> {
  const model = reportJudgeModel();
  for (let i = 0; i < WAIT_BEFORE_MS.length; i++) {
    if (WAIT_BEFORE_MS[i]) await new Promise((r) => setTimeout(r, WAIT_BEFORE_MS[i]));
    const report = findUserReport(reportId);
    if (!report || report.aiDecision !== "pending") return;
    const verdict = await judgeOnce(report, model).catch(() => null);
    if (verdict) {
      applyVerdict(report, verdict, i + 1);
      return;
    }
    updateUserReport(reportId, { aiAttempts: i + 1 });
  }
  updateUserReport(reportId, {
    status: "open",
    aiDecision: "error",
    aiReason: "El revisor falló 4 veces. Lo revisa una persona.",
    aiAt: new Date().toISOString(),
  });
}

/** Lanza la revisión sin hacer esperar a quien denunció. */
export function queueProfileReview(reportId: string): void {
  if (inFlight.has(reportId)) return;
  inFlight.add(reportId);
  void review(reportId)
    .catch((e) => console.warn("[report-judge] review failed:", e))
    .finally(() => inFlight.delete(reportId));
}

/** Retoma denuncias que quedaron a medias (por ejemplo, si el servidor se reinició). */
export function resumePendingReviews(): void {
  for (const r of listUserReports()) {
    if (r.aiDecision === "pending") queueProfileReview(r.id);
  }
}
