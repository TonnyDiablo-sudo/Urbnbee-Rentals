import { NextRequest, NextResponse } from "next/server";
import { canSeeChatThread, readChatAttachment } from "@/lib/chat-attachments";
import { privateFileResponse } from "@/lib/file-response";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ listingId: string; guestSessionId: string; file: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { listingId, guestSessionId, file } = await ctx.params;
  const user = await getSessionUser();
  if (!user || !canSeeChatThread(user.id, listingId, guestSessionId)) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  const found = await readChatAttachment(listingId, guestSessionId, file);
  if (!found) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return privateFileResponse(req, found.data, found.mime);
}
