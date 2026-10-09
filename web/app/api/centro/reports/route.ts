import { NextResponse } from "next/server";
import { findUserById, getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { hasStaffPermission } from "@/lib/staff";
import { moderateReportedContent } from "@/lib/user-reports";
import { listUserReports } from "@/lib/user-reports-store";

export const runtime = "nodejs";

export async function GET() {
  const viewer = await getSessionUser();
  if (!hasStaffPermission(viewer, "reports")) return NextResponse.json({ error: "No tienes acceso a esta sección." }, { status: 403 });
  const canModerate = hasStaffPermission(viewer, "moderate");
  const reports = listUserReports()
    .filter((r) => r.kind === "report_account")
    .slice(0, 100)
    .map((r) => {
      const target = r.targetUserId ? findUserById(r.targetUserId) : undefined;
      const listing = r.listingId ? getListingById(r.listingId) : undefined;
      return {
        id: r.id,
        category: r.category,
        message: r.message,
        answers: r.answers ?? null,
        status: r.status,
        createdAt: r.createdAt,
        aiDecision: r.aiDecision ?? null,
        aiReason: r.aiReason ?? "",
        targetName: target?.fullName ?? r.targetLabel ?? "",
        suspended: Boolean(target?.suspendedAt),
        listingId: r.listingId ?? "",
        listingTitle: listing?.title ?? "",
      };
    });
  return NextResponse.json({ reports, canModerate });
}

export async function POST(req: Request) {
  const viewer = await getSessionUser();
  if (!hasStaffPermission(viewer, "moderate")) return NextResponse.json({ error: "No tienes acceso a esta sección." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; action?: unknown };
  const action = body.action === "hide_messages" || body.action === "unpublish" ? body.action : null;
  if (!action || typeof body.id !== "string") return NextResponse.json({ error: "Falta el reporte." }, { status: 400 });
  const result = moderateReportedContent(body.id, action);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, detail: result.detail });
}
