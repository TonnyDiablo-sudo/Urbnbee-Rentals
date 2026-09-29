import { NextResponse } from "next/server";
import { createListing, getListingById, listListingsForHost } from "@/lib/marketplace-store";
import { syncHostBadgeToListings } from "@/lib/host-verification";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const listings = listListingsForHost(user.id);
  return NextResponse.json({ listings });
}

export async function POST() {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const created = createListing(user.id);
  // El anuncio nuevo nace sin insignia; si el anfitrión ya está verificado, la hereda.
  syncHostBadgeToListings(user.id);
  return NextResponse.json({ listing: getListingById(created.id) ?? created });
}
