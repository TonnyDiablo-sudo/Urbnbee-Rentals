import { NextRequest, NextResponse } from "next/server";
import { getListingDetail } from "@/lib/get-listing-detail";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { summarizeWishlist } from "@/lib/wishlist-view";
import { WishlistError, createWishlist, listWishlistsForUser, setWishlistItem } from "@/lib/wishlists-store";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  const lists = listWishlistsForUser(user.id).map((l) => summarizeWishlist(l, user.id));
  return NextResponse.json({ lists }, { headers: { "Cache-Control": "no-store" } });
}

/** Crea una lista; si viene `slug`, ya guarda ese alojamiento. */
export async function POST(req: NextRequest) {
  const t = await getT();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: t("Inicia sesión.") }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const slug = typeof body.slug === "string" ? body.slug : "";
  if (slug && !getListingDetail(slug)) return NextResponse.json({ error: t("Ese alojamiento ya no existe.") }, { status: 404 });
  try {
    let list = createWishlist(user.id, { name: body.name, checkIn: body.checkIn, checkOut: body.checkOut });
    if (slug) list = setWishlistItem(list.id, user.id, slug, true);
    return NextResponse.json({ list: summarizeWishlist(list, user.id) });
  } catch (e) {
    if (e instanceof WishlistError) return NextResponse.json({ error: t(e.message) }, { status: e.status });
    throw e;
  }
}
