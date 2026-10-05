import { NextRequest, NextResponse } from "next/server";
import { emailRequiredResponse } from "@/lib/email-gate";
import { getListingStats, recordContactView, viewerKeyFrom } from "@/lib/listing-stats-store";
import { getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para registrar la consulta.", needsLogin: true }, { status: 401 });
  }

  const { id } = await params;
  const listing = getListingById(id);
  if (listing && listing.hostId !== user.id) {
    const blocked = emailRequiredResponse(user, "contacts");
    if (blocked) return blocked;
    recordContactView(id, viewerKeyFrom({ userId: user.id }));
  }
  return NextResponse.json({ ok: true, views: listing ? getListingStats(id).contactsTotal : 0 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json({ views: getListingById(id) ? getListingStats(id).contactsTotal : 0 });
}
