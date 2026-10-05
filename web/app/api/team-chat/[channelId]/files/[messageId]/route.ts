import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { readTeamFile } from "@/lib/team-chat-service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ channelId: string; messageId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { channelId, messageId } = await ctx.params;
  const f = await readTeamFile(user.id, channelId, messageId);
  if (!f) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  const headers: Record<string, string> = {
    "Content-Type": f.attachment.mime,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };
  if (f.attachment.kind === "file") {
    headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(f.attachment.name || "archivo")}`;
  }
  return new NextResponse(new Uint8Array(f.buf), { headers });
}
