import { NextResponse } from "next/server";
import { listBookingsForGuest } from "@/lib/bookings-store";
import { getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const rows = listBookingsForGuest(user.id);
  const bookings = rows.map((b) => {
    const listing = getListingById(b.listingId);
    const effId = b.hostAdjustedListingId ?? b.listingId;
    const effListing = effId !== b.listingId ? getListingById(effId) : listing;
    return {
      ...b,
      listingTitle: listing?.title ?? "Alojamiento",
      listingSlug: effListing?.slug ?? listing?.slug,
    };
  });

  return NextResponse.json({ bookings });
}
