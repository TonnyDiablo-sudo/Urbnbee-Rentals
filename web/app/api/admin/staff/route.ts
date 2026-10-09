import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { rememberAssociatePassword } from "@/lib/associate-password-vault";
import { generateTempPassword } from "@/lib/associate-provision";
import { createUser, findUserByEmail, listAllUsers, updateUserAuth } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { parseStaffPermissions, STAFF_PERMISSIONS } from "@/lib/staff";

export const runtime = "nodejs";

function staffView() {
  return listAllUsers()
    .filter((u) => (u.staffPermissions?.length ?? 0) > 0)
    .map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      permissions: parseStaffPermissions(u.staffPermissions),
    }));
}

export async function GET() {
  const viewer = await getSessionUser();
  if (!viewer || viewer.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ permissions: STAFF_PERMISSIONS, staff: staffView() });
}

/** Crea o actualiza un administrador de segundo nivel. Sin permisos, le quita el acceso. */
export async function POST(req: Request) {
  const viewer = await getSessionUser();
  if (!viewer || viewer.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 160);
  const fullName = String(body.fullName ?? "").replace(/[<>]/g, "").trim().slice(0, 120);
  const permissions = parseStaffPermissions(body.permissions);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "El correo no es válido." }, { status: 400 });

  const existing = findUserByEmail(email);
  if (existing?.role === "admin") return NextResponse.json({ error: "Esa cuenta ya es administradora." }, { status: 409 });

  if (permissions.length === 0) {
    if (!existing) return NextResponse.json({ error: "Elige al menos un permiso." }, { status: 400 });
    updateUserAuth(existing.id, { staffPermissions: undefined });
    return NextResponse.json({ ok: true, removed: true, staff: staffView() });
  }

  if (existing) {
    updateUserAuth(existing.id, { staffPermissions: permissions });
    return NextResponse.json({ ok: true, created: false, staff: staffView() });
  }

  if (fullName.length < 2) return NextResponse.json({ error: "Escribe el nombre." }, { status: 400 });
  const password = generateTempPassword();
  const user = createUser({
    email,
    passwordHash: await bcrypt.hash(password, 11),
    fullName,
    role: "guest",
    mustChangePassword: true,
  });
  updateUserAuth(user.id, { staffPermissions: permissions });
  rememberAssociatePassword(user.id, password);
  return NextResponse.json({
    ok: true,
    created: true,
    credentials: { email, password },
    staff: staffView(),
  });
}
