import { NextRequest, NextResponse } from "next/server";
import { bridgeChatAiChanged } from "@/lib/beeagent-chat-bridge";
import { getChatAi, setChatAi } from "@/lib/chat-ai-settings";
import { getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { memberCan } from "@/lib/team-access";

export const runtime = "nodejs";

async function allowed(listingId: string) {
  const user = await getSessionUser();
  if (!user) return null;
  const listing = getListingById(listingId);
  if (!listing) return null;
  const owner = listing.hostId === user.id && (user.role === "host" || user.role === "admin");
  if (!owner && !memberCan(user.id, listing.hostId, "messages", listing.id)) return null;
  return listing;
}

/** Si el agente de urbnbeeai contesta esta conversación. */
export async function GET(req: NextRequest) {
  const listingId = req.nextUrl.searchParams.get("listingId")?.trim() ?? "";
  const guestSessionId = req.nextUrl.searchParams.get("guestSessionId")?.trim() ?? "";
  const listing = listingId && guestSessionId ? await allowed(listingId) : null;
  if (!listing) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return NextResponse.json(getChatAi(listing.hostId, listingId, guestSessionId));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const listingId = typeof body.listingId === "string" ? body.listingId.trim() : "";
  const guestSessionId = typeof body.guestSessionId === "string" ? body.guestSessionId.trim() : "";
  const listing = listingId && guestSessionId ? await allowed(listingId) : null;
  if (!listing) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });

  const r = setChatAi({ hostId: listing.hostId, listingId, guestSessionId, enabled: body.enabled, by: "host" });
  if (!r.ok) {
    return NextResponse.json({ error: "Tu agente de urbnbeeai no está activo.", ...r.state }, { status: 409 });
  }
  bridgeChatAiChanged(listing.hostId, listingId, guestSessionId, r.state);
  return NextResponse.json(r.state);
}
