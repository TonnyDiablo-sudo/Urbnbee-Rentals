import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { listBookingsForHost } from "@/lib/bookings-store";
import { getListingById } from "@/lib/marketplace-store";

export async function GET() {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const rows = listBookingsForHost(user.id);
  const bookings = rows.map((b) => {
    const listing = getListingById(b.listingId);
    const adjId = b.hostAdjustedListingId ?? b.listingId;
    const adjListing = adjId !== b.listingId ? getListingById(adjId) : listing;
    return {
      ...b,
      listingTitle: listing?.title ?? "Alojamiento",
      effectiveListingTitle: (b.hostAdjustedListingId ? adjListing : listing)?.title ?? listing?.title,
    };
  });

  return NextResponse.json({ bookings });
}
