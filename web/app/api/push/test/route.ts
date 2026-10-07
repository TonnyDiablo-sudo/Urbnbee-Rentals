import { NextResponse } from "next/server";
import { sendTestPush } from "@/lib/push";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Manda un aviso de prueba a todos los dispositivos del usuario y dice qué pasó con cada uno. */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  const r = await sendTestPush(user.id);
  return NextResponse.json(r);
}
