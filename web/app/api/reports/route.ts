import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { listReportCounterparts, myReportViews, submitUserReport } from "@/lib/user-reports";

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
  return NextResponse.json({ ok: true, id: result.report.id });
}
