import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getListingById } from "@/lib/marketplace-store";
import { appendMessage } from "@/lib/host-inbox-store";
import { sanitizeBodyText } from "@/lib/host-inbox-sanitize";
import { allowHostInboxPost } from "@/lib/host-inbox-rate-limit";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!allowHostInboxPost(`host:${user.id}`, 8_000)) {
    return NextResponse.json({ error: "Espera unos segundos entre respuestas." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const listingId = typeof body.listingId === "string" ? body.listingId.trim() : "";
  const guestSessionId =
    typeof body.guestSessionId === "string" ? body.guestSessionId.trim() : "";
  const text = sanitizeBodyText(body.body);

  if (!listingId || !guestSessionId) {
    return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  }
  if (!text.length) {
    return NextResponse.json({ error: "Escribe un mensaje." }, { status: 400 });
  }

  const listing = getListingById(listingId);
  if (!listing || listing.hostId !== user.id) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  appendMessage({
    listingId,
    hostId: listing.hostId,
    guestSessionId,
    sender: "host",
    guestName: "",
    body: text,
  });

  return NextResponse.json({ ok: true });
}
