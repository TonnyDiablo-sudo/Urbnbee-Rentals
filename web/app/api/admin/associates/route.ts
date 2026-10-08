import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { generateTempPassword } from "@/lib/associate-provision";
import { createUser, findUserByEmail, updateUserAuth } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

function goalFrom(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 500 ? Math.round(n) : undefined;
}

/** Da de alta a un asociado: si el correo ya tiene cuenta le da acceso; si no, la crea con contraseña temporal. */
export async function POST(req: Request) {
  const viewer = await getSessionUser();
  if (!viewer || viewer.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 160);
  const fullName = String(body.fullName ?? "").replace(/[<>]/g, "").trim().slice(0, 120);
  const goal = goalFrom(body.dailyGoal);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "El correo no es válido." }, { status: 400 });

  const existing = findUserByEmail(email);
  if (existing) {
    if (existing.provisionedBy && !existing.claimedAt) {
      return NextResponse.json({ error: "Esa es una cuenta de anfitrión creada por un asociado." }, { status: 409 });
    }
    updateUserAuth(existing.id, { associate: true, ...(goal !== undefined ? { associateDailyGoal: goal } : {}) });
    return NextResponse.json({ ok: true, id: existing.id, created: false });
  }

  if (fullName.length < 2) return NextResponse.json({ error: "Escribe el nombre del asociado." }, { status: 400 });
  const password = generateTempPassword();
  const user = createUser({
    email,
    passwordHash: await bcrypt.hash(password, 11),
    fullName,
    role: "guest",
    mustChangePassword: true,
  });
  updateUserAuth(user.id, { associate: true, ...(goal !== undefined ? { associateDailyGoal: goal } : {}) });
  return NextResponse.json({ ok: true, id: user.id, created: true, credentials: { email, password } });
}
