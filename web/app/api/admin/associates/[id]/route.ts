import { NextResponse } from "next/server";
import { findUserById, updateUserAuth } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

/** Meta diaria o quitar el acceso. Las cuentas que ya creó siguen marcadas con su nombre. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getSessionUser();
  if (!viewer || viewer.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const target = findUserById(id);
  if (!target) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.associate === false) {
    updateUserAuth(id, { associate: undefined, associateTokenHash: undefined });
    return NextResponse.json({ ok: true });
  }
  if (body.associate === true) {
    updateUserAuth(id, { associate: true });
    return NextResponse.json({ ok: true });
  }
  if (body.dailyGoal !== undefined) {
    const n = Number(body.dailyGoal);
    if (!Number.isFinite(n) || n < 0 || n > 500) {
      return NextResponse.json({ error: "Meta inválida." }, { status: 400 });
    }
    updateUserAuth(id, { associateDailyGoal: Math.round(n) });
    return NextResponse.json({ ok: true, dailyGoal: Math.round(n) });
  }
  return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });
}
