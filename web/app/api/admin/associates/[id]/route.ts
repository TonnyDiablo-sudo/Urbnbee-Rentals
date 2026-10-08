import { NextResponse } from "next/server";
import { forgetAssociatePassword, revealAssociatePassword } from "@/lib/associate-password-vault";
import { findUserById, updateUserAuth } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

/** Contraseña actual del asociado; sólo se manda cuando el admin la pide. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getSessionUser();
  if (!viewer || viewer.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const target = findUserById(id);
  if (!target?.associate) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  const found = revealAssociatePassword(target);
  if (!found) {
    return NextResponse.json(
      { error: "Todavía no la tenemos: se guarda la próxima vez que el asociado inicie sesión o cambie su contraseña." },
      { status: 404 }
    );
  }
  console.info(`[associates] admin ${viewer.id} vio la contraseña de ${target.id}`);
  return NextResponse.json(
    { email: target.email, password: found.password, at: found.at ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}

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
    forgetAssociatePassword(id);
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
