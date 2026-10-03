import { NextRequest, NextResponse } from "next/server";
import { canSeeChatThread, readChatAttachment } from "@/lib/chat-attachments";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ listingId: string; guestSessionId: string; file: string }> };

/** Safari pide las notas de voz por pedazos (Range); sin 206 no las reproduce. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { listingId, guestSessionId, file } = await ctx.params;
  const user = await getSessionUser();
  if (!user || !canSeeChatThread(user.id, listingId, guestSessionId)) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  const found = await readChatAttachment(listingId, guestSessionId, file);
  if (!found) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  const total = found.data.byteLength;
  const headers: Record<string, string> = {
    "content-type": found.mime,
    "cache-control": "private, max-age=86400",
    "accept-ranges": "bytes",
    "x-content-type-options": "nosniff",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range) {
    let start = range[1] ? Number(range[1]) : total - Number(range[2] || 0);
    let end = range[1] && range[2] ? Number(range[2]) : total - 1;
    if (!range[1]) end = total - 1;
    start = Math.max(0, start);
    end = Math.min(total - 1, end);
    if (start > end || start >= total) {
      return new NextResponse(null, { status: 416, headers: { ...headers, "content-range": `bytes */${total}` } });
    }
    return new NextResponse(new Uint8Array(found.data.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${total}`, "content-length": String(end - start + 1) },
    });
  }
  return new NextResponse(new Uint8Array(found.data), { headers: { ...headers, "content-length": String(total) } });
}
