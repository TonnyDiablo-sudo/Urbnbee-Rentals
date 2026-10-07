import { NextRequest, NextResponse } from "next/server";
import { findUserById } from "@/lib/marketplace-store";
import { pushConfigured, sendTestPush } from "@/lib/push";
import { listSubscriptions } from "@/lib/push-store";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAdmin() {
  const user = await getSessionUser();
  return Boolean(user && user.role === "admin");
}

function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return "?";
  }
}

/** Dispositivos registrados para push (sin llaves ni endpoints completos). */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const devices = listSubscriptions().map((s) => ({
    userId: s.userId,
    email: findUserById(s.userId)?.email ?? "—",
    service: hostOf(s.endpoint),
    createdAt: s.createdAt,
    userAgent: s.userAgent ?? "",
  }));
  devices.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({
    configured: pushConfigured(),
    subject: process.env.VAPID_SUBJECT?.trim() || "mailto:soporte@cabibee.com",
    devices,
  });
}

/** Manda un aviso de prueba a un usuario. */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { userId?: unknown };
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId || !findUserById(userId)) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  return NextResponse.json(await sendTestPush(userId));
}
