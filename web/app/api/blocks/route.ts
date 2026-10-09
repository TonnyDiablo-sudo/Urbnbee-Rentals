import { NextRequest, NextResponse } from "next/server";
import { findUserById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { blockUser, isBlockedBy, unblockUser } from "@/lib/user-blocks-store";

export const dynamic = "force-dynamic";

function otherId(raw: unknown): string | null {
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id || id.length > 80) return null;
  return findUserById(id) ? id : null;
}

export async function GET(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const other = otherId(req.nextUrl.searchParams.get("userId"));
  if (!other) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return NextResponse.json({ blocked: isBlockedBy(me.id, other) });
}

export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const other = otherId(body?.userId);
  if (!other || other === me.id) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  blockUser(me.id, other);
  return NextResponse.json({ ok: true, blocked: true });
}

export async function DELETE(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const other = otherId(body?.userId);
  if (!other) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  unblockUser(me.id, other);
  return NextResponse.json({ ok: true, blocked: false });
}
