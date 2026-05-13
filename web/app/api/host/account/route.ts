import { NextRequest, NextResponse } from "next/server";
import { updateUser } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const body = await req.json();
  const fullName = body.fullName !== undefined ? String(body.fullName).trim() : undefined;
  const phone = body.phone !== undefined ? String(body.phone).trim() : undefined;

  const next = updateUser(user.id, {
    ...(fullName !== undefined ? { fullName } : {}),
    ...(phone !== undefined ? { phone } : {}),
  });
  if (!next) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  return NextResponse.json({
    user: { id: next.id, email: next.email, fullName: next.fullName, phone: next.phone, role: next.role },
  });
}
