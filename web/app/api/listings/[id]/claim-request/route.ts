import { NextRequest, NextResponse } from "next/server";
import { createClaimRequest } from "@/lib/listing-claims-store";
import { findUserById, getListingById } from "@/lib/marketplace-store";

const recent = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function limited(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > MAX_PER_WINDOW;
}

function text(v: unknown, max: number): string {
  return String(v ?? "").replace(/[<>]/g, "").trim().slice(0, max);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  if (limited(ip)) return NextResponse.json({ error: "Demasiadas solicitudes. Intenta más tarde." }, { status: 429 });

  const { id } = await ctx.params;
  const listing = getListingById(id);
  const host = listing ? findUserById(listing.hostId) : undefined;
  if (!listing || !host?.provisionedBy) return NextResponse.json({ error: "Anuncio no encontrado." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const kind = body.kind === "remove" ? "remove" : "claim";
  const name = text(body.name, 120);
  const contact = text(body.contact, 160);
  if (name.length < 2 || contact.length < 6) {
    return NextResponse.json({ error: "Escribe tu nombre y un teléfono o correo para contactarte." }, { status: 400 });
  }

  createClaimRequest({
    listingId: listing.id,
    listingTitle: listing.title,
    hostId: listing.hostId,
    kind,
    name,
    contact,
    message: text(body.message, 2000),
  });
  return NextResponse.json({ ok: true });
}
