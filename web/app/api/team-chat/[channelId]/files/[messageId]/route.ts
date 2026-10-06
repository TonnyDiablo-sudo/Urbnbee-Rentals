import { NextRequest, NextResponse } from "next/server";
import { privateFileResponse } from "@/lib/file-response";
import { getSessionUser } from "@/lib/session";
import { readTeamFile } from "@/lib/team-chat-service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ channelId: string; messageId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { channelId, messageId } = await ctx.params;
  const f = await readTeamFile(user.id, channelId, messageId);
  if (!f) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  const res = privateFileResponse(req, f.buf, f.attachment.mime);
  if (f.attachment.kind === "file") {
    res.headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(f.attachment.name || "archivo")}`);
  }
  return res;
}
