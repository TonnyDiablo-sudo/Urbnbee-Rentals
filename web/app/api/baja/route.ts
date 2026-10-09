import { NextRequest, NextResponse } from "next/server";
import { optOutByToken } from "@/lib/associate-outreach";

export const runtime = "nodejs";

/** El dueño pide que quitemos su anuncio desde el enlace del aviso. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token.slice(0, 100) : "";
  const res = optOutByToken(token);
  if (!res.ok) return NextResponse.json({ error: "El enlace no es válido." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
