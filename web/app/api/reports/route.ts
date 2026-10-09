import { NextResponse } from "next/server";
import { notifyUser } from "@/lib/push";
import { queueProfileReview, resumePendingReviews } from "@/lib/report-judge";
import { getSessionUser } from "@/lib/session";
import { emailSupportAboutReport } from "@/lib/support-inbox";
import { listReportCounterparts, myReportViews, submitUserReport } from "@/lib/user-reports";
import { updateUserReport } from "@/lib/user-reports-store";
import { reportReceipt } from "@/lib/user-reports-types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  return NextResponse.json({
    reports: myReportViews(user.id),
    counterparts: listReportCounterparts(user.id),
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const result = submitUserReport(user, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const report = result.report;
  const receipt = reportReceipt(report.id);

  const reviewable = report.kind === "report_account" && Boolean(report.targetUserId) && Boolean(report.answers);
  if (reviewable) {
    updateUserReport(report.id, { status: "in_review", aiDecision: "pending" });
    notifyUser(user.id, {
      kind: "support",
      title: "Reporte {receipt}",
      body: "Estamos revisando la cuenta que reportaste. Te avisamos si tomamos medidas.",
      vars: { receipt },
      url: "/reportar",
      tag: `report-${report.id}`,
    });
    queueProfileReview(report.id);
  }
  resumePendingReviews();
  void emailSupportAboutReport(report);

  return NextResponse.json({
    ok: true,
    id: report.id,
    receipt,
    blockUserId: report.kind === "report_account" && report.targetUserId ? report.targetUserId : undefined,
  });
}
