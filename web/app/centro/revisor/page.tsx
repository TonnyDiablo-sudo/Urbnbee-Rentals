import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { findUserById } from "@/lib/marketplace-store";
import { reportJudgeModel, resumePendingReviews } from "@/lib/report-judge";
import { getSessionUser } from "@/lib/session";
import { hasStaffPermission } from "@/lib/staff";
import { listUserReports } from "@/lib/user-reports-store";
import { reportReceipt, type ReportAiDecision } from "@/lib/user-reports-types";

export const dynamic = "force-dynamic";

const BADGE = {
  pending: "bg-blue-100 text-blue-800",
  suspend: "bg-red-100 text-red-700",
  keep: "bg-gray-100 text-gray-700",
  error: "bg-amber-100 text-amber-800",
} as const;

const LABEL = {
  pending: "Revisando",
  suspend: "Suspendió la cuenta",
  keep: "No suspendió",
  error: "Pasó a una persona",
} as const;

export default async function ReviewerPanelPage() {
  const user = await getSessionUser();
  if (!hasStaffPermission(user, "agent")) redirect("/centro");
  const t = await getT();
  resumePendingReviews();

  const rows = listUserReports().filter((r) => r.aiDecision);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const count = (d: ReportAiDecision) => rows.filter((r) => r.aiDecision === d).length;
  const lastWeek = rows.filter((r) => Date.parse(r.aiAt ?? r.createdAt) >= weekAgo).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{t("Revisor de denuncias")}</h1>
        <p className="text-sm text-gray-500">
          {t("Modelo:")} <span className="font-mono">{reportJudgeModel()}</span> ·{" "}
          {t("Lee cada denuncia de cuenta al llegar y decide si la suspende.")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Últimos 7 días", value: lastWeek },
          { label: "Revisando", value: count("pending") },
          { label: "Suspendió", value: count("suspend") },
          { label: "No suspendió", value: count("keep") },
          { label: "Pasó a una persona", value: count("error") },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">{t(s.label)}</p>
            <p className="text-2xl font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">{t("Todavía no ha revisado ninguna denuncia.")}</p>
      ) : (
        <ul className="space-y-3">
          {rows.slice(0, 200).map((r) => {
            const target = r.targetUserId ? findUserById(r.targetUserId) : undefined;
            const decision = r.aiDecision!;
            return (
              <li key={r.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${BADGE[decision]}`}>{t(LABEL[decision])}</span>
                  <span className="font-mono text-gray-400">{reportReceipt(r.id)}</span>
                  {(r.aiAttempts ?? 0) > 0 && (
                    <span className="text-gray-400">· {t("{n} de 4 intentos", { n: r.aiAttempts ?? 0 })}</span>
                  )}
                  <span className="font-semibold text-gray-800">{t(r.category)}</span>
                  <span className="text-gray-500">· {target?.fullName ?? r.targetLabel ?? t("Cuenta sin identificar")}</span>
                  {target?.suspendedAt && <span className="text-red-700">· {t("Suspendida ahora")}</span>}
                  {target && !target.suspendedAt && decision === "suspend" && (
                    <span className="text-green-700">· {t("Ya habilitada")}</span>
                  )}
                  <span className="ml-auto text-gray-400">
                    {new Date(r.aiAt ?? r.createdAt).toLocaleString()} · {r.aiModel ?? ""}
                  </span>
                </div>
                {r.aiReason && <p className="mt-2 text-sm text-gray-800">{r.aiReason}</p>}
                {r.answers && (
                  <p className="mt-1 text-xs text-gray-500">
                    {t(r.answers.where)} · {t(r.answers.ongoing)}
                  </p>
                )}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-gray-500">{t("Ver lo que escribió quien denunció")}</summary>
                  <p className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">{r.message}</p>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
