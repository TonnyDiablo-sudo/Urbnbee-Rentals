import { NextRequest, NextResponse } from "next/server";
import { deleteProofsForListing } from "@/lib/address-proof-store";
import { listClaimRequests, resolveClaimRequest } from "@/lib/listing-claims-store";
import { deleteListing, findUserById, getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";

async function requireAdmin() {
  const user = await getSessionUser();
  return user?.role === "admin" ? user : null;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = listClaimRequests().map((c) => {
    const listing = getListingById(c.listingId);
    const host = findUserById(c.hostId);
    return {
      ...c,
      listingSlug: listing?.slug,
      listingExists: Boolean(listing),
      hostEmail: host?.email,
      hostClaimed: Boolean(host?.claimedAt),
      provisionedBy: host?.provisionedBy ? findUserById(host.provisionedBy)?.fullName : undefined,
    };
  });
  return NextResponse.json({ claims: rows });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { id?: string; action?: string };
  const claim = listClaimRequests().find((c) => c.id === body.id);
  if (!claim) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  if (body.action === "delete_listing") {
    const listing = getListingById(claim.listingId);
    if (listing && deleteListing(listing.id, listing.hostId)) deleteProofsForListing(listing.id);
    return NextResponse.json({ claim: resolveClaimRequest(claim.id, "listing_deleted") });
  }
  if (body.action === "handed_over") {
    return NextResponse.json({ claim: resolveClaimRequest(claim.id, "handed_over") });
  }
  if (body.action === "dismiss") {
    return NextResponse.json({ claim: resolveClaimRequest(claim.id, "dismissed") });
  }
  return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
}
