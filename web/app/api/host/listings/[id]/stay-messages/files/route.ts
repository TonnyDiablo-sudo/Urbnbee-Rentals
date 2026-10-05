import { NextRequest, NextResponse } from "next/server";
import { CHAT_MEDIA_LOCKED_ERROR, chatMediaAllowed } from "@/lib/chat-media-access";
import { allowHostInboxPost } from "@/lib/host-inbox-rate-limit";
import { getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { storeStayMessageFile } from "@/lib/stay-messages";

export const runtime = "nodejs";

/** Sube una foto o un audio para los mensajes de la estancia. multipart: file, durationSec. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const listing = getListingById(id);
  if (!listing || listing.hostId !== user.id) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  if (!chatMediaAllowed(user, { as: "host", listingHostId: listing.hostId })) {
    return NextResponse.json({ error: CHAT_MEDIA_LOCKED_ERROR, needsIdentity: true }, { status: 403 });
  }
  if (!allowHostInboxPost(`staymsg:${user.id}`, 1_500)) {
    return NextResponse.json({ error: "Espera unos segundos entre envíos." }, { status: 429 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "No llegó el archivo." }, { status: 400 });
  }
  const stored = await storeStayMessageFile({
    listingId: listing.id,
    data: Buffer.from(await file.arrayBuffer()),
    mime: file.type || "application/octet-stream",
    durationSec: Number(form.get("durationSec")),
  }).catch(() => ({ error: "No se pudo guardar el archivo." }) as { error: string });
  if (!("attachment" in stored) || !stored.attachment) {
    return NextResponse.json({ error: stored.error ?? "No se pudo guardar el archivo." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, attachment: stored.attachment });
}
