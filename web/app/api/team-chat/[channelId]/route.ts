import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import {
  editTeamChannel,
  postTeamFile,
  postTeamText,
  removeTeamChannel,
  removeTeamMessage,
  teamMessagesView,
} from "@/lib/team-chat-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ channelId: string }> };

const UPLOAD_MAX_BYTES = 12 * 1024 * 1024;

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { channelId } = await ctx.params;
  const v = teamMessagesView(user.id, channelId);
  if (!v) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return NextResponse.json(v);
}

/** Mensaje de texto (JSON) o foto, audio o archivo (multipart). */
export async function POST(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { channelId } = await ctx.params;
  if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file === "string") return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
    if (file.size > UPLOAD_MAX_BYTES) return NextResponse.json({ error: "El archivo pesa más de 10 MB." }, { status: 413 });
    const caption = form?.get("caption");
    const duration = Number(form?.get("durationSec"));
    const r = await postTeamFile(
      user.id,
      channelId,
      { buf: Buffer.from(await file.arrayBuffer()), mime: file.type || "application/octet-stream", name: file.name || "archivo" },
      { caption: typeof caption === "string" ? caption : undefined, durationSec: Number.isFinite(duration) ? duration : undefined }
    );
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true });
  }
  const body = (await req.json().catch(() => ({}))) as { body?: unknown };
  const r = postTeamText(user.id, channelId, body.body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { channelId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { name?: unknown; emoji?: unknown };
  const r = editTeamChannel(user.id, channelId, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}

/** Sin `?message=` borra el chat completo. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { channelId } = await ctx.params;
  const messageId = req.nextUrl.searchParams.get("message");
  const r = messageId ? await removeTeamMessage(user.id, channelId, messageId) : await removeTeamChannel(user.id, channelId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
