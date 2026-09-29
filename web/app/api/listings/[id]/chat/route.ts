import { NextRequest, NextResponse } from "next/server";
import { allowHostInboxPost } from "@/lib/host-inbox-rate-limit";
import { resolveListingDetail } from "@/lib/get-listing-detail";
import { listingHasBeeagent, tryBeeagentListingChat } from "@/lib/listing-chat-beeagent";
import { listingChatLocalReply } from "@/lib/listing-chat-local";
import { getListingById, getListingBySlug } from "@/lib/marketplace-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function hostListingRecord(idOrSlug: string) {
  return getListingById(idOrSlug) ?? getListingBySlug(idOrSlug);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = hostListingRecord(id);
  const linked = Boolean(record && listingHasBeeagent(record.hostId));
  return NextResponse.json({
    linked,
    viaPreferred: linked ? "beeagent" : "cabibee",
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!allowHostInboxPost(`listing_chat:${clientIp(req)}:${id}`, 800)) {
    return NextResponse.json(
      { error: "Espera un momento antes de enviar otro mensaje." },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    message?: unknown;
    sessionId?: unknown;
  };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ reply: "Por favor escribe tu pregunta.", via: "cabibee" });
  }

  const listing = resolveListingDetail(id);
  if (!listing) {
    return NextResponse.json({ reply: "No encontré información sobre este alojamiento.", via: "cabibee" });
  }

  const record = hostListingRecord(id);
  if (record?.published && listingHasBeeagent(record.hostId)) {
    const fromAgent = await tryBeeagentListingChat({
      listing: record,
      message,
      sessionId: body.sessionId,
    });
    if (fromAgent) {
      return NextResponse.json({ reply: fromAgent.reply, via: "beeagent" });
    }
  }

  const reply = await listingChatLocalReply(listing, message);
  return NextResponse.json({ reply, via: "cabibee" });
}
