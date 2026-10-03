import { NextResponse } from "next/server";
import { attachmentPreview } from "@/lib/chat-attachments";
import { listAllThreadsForGuest } from "@/lib/host-inbox-store";
import { getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const threads = listAllThreadsForGuest(user.id);
  const out = threads.map((t) => {
    const listing = getListingById(t.listingId);
    const last = t.messages[t.messages.length - 1];
    return {
      listingId: t.listingId,
      listingTitle: listing?.title ?? "Anuncio no disponible",
      listingSlug: listing?.published ? listing.slug : undefined,
      lastAt: t.lastAt,
      lastPreview: last?.body?.slice(0, 140) || (last?.attachment ? attachmentPreview(last.attachment.kind) : ""),
      lastSender: last?.sender,
      messageCount: t.messages.length,
    };
  });

  return NextResponse.json({ threads: out });
}
