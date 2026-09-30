import { NextRequest, NextResponse } from "next/server";
import { sampleContractLines } from "@/lib/booking-contract";
import { BOOKING_CONTRACT_TEMPLATES, sanitizeListingContract } from "@/lib/booking-contract-templates";
import { findUserById, getHostProfile, getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";

async function hostOnly() {
  const user = await getSessionUser();
  return user && (user.role === "host" || user.role === "admin") ? user : null;
}

/** Machotes disponibles y los datos de la cuenta con los que se prellenan. */
export async function GET() {
  const user = await hostOnly();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const u = findUserById(user.id);
  const p = getHostProfile(user.id);
  return NextResponse.json({
    templates: BOOKING_CONTRACT_TEMPLATES,
    account: {
      fullName: u?.fullName ?? "",
      addressLine: u?.addressLine ?? "",
      email: p?.email || user.email,
      phone: p?.phone || u?.phone || "",
    },
  });
}

/** Vista previa del contrato de un anuncio con los ajustes que el anfitrión está editando (no guarda). */
export async function POST(req: NextRequest) {
  const user = await hostOnly();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { listingId?: string; contract?: unknown };
  const listing = body.listingId ? getListingById(body.listingId) : undefined;
  if (!listing || listing.hostId !== user.id) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  const settings = sanitizeListingContract(body.contract, sanitizeListingContract(listing.contract));
  const lines = sampleContractLines(listing.id, settings);
  if (!lines) return NextResponse.json({ error: "No se pudo armar el contrato." }, { status: 409 });
  return NextResponse.json({ lines });
}
