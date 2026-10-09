import { NextResponse } from "next/server";
import { myAppeal, submitAccountAppeal } from "@/lib/account-appeals";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const appeal = myAppeal(user.id);
  return NextResponse.json({
    suspended: Boolean(user.suspendedAt) && user.role !== "admin",
    reason: user.suspendReason ?? "",
    appeal: appeal
      ? { status: appeal.status, message: appeal.message, createdAt: appeal.createdAt }
      : null,
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { message?: unknown };
  const result = submitAccountAppeal(user, typeof body.message === "string" ? body.message : "");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
