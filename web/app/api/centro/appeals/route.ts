import { NextResponse } from "next/server";
import { decideAccountAppeal } from "@/lib/account-appeals";
import { listAppeals } from "@/lib/account-appeals-store";
import { findUserById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { hasStaffPermission } from "@/lib/staff";

export const runtime = "nodejs";

export async function GET() {
  const viewer = await getSessionUser();
  if (!hasStaffPermission(viewer, "appeals")) return NextResponse.json({ error: "No tienes acceso a esta sección." }, { status: 403 });
  const appeals = listAppeals().map((a) => {
    const user = findUserById(a.userId);
    return {
      ...a,
      stillSuspended: Boolean(user?.suspendedAt),
      suspendReason: user?.suspendReason ?? "",
    };
  });
  return NextResponse.json({ appeals });
}

export async function POST(req: Request) {
  const viewer = await getSessionUser();
  if (!viewer) return NextResponse.json({ error: "No tienes acceso a esta sección." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; action?: unknown; note?: unknown };
  const action = body.action === "restore" || body.action === "uphold" ? body.action : null;
  if (!action || typeof body.id !== "string") return NextResponse.json({ error: "Falta la solicitud." }, { status: 400 });
  const result = decideAccountAppeal(viewer, body.id, action, typeof body.note === "string" ? body.note : "");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
