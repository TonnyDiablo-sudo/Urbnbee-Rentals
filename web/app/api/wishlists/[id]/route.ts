import { NextRequest, NextResponse } from "next/server";
import { getListingDetail } from "@/lib/get-listing-detail";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { summarizeWishlist } from "@/lib/wishlist-view";
import {
  WishlistError,
  deleteOrLeaveWishlist,
  ensureShareToken,
  removeWishlistMember,
  resetWishlistSharing,
  setWishlistItem,
  updateWishlist,
} from "@/lib/wishlists-store";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Cambios a una lista:
 *   { name?, checkIn?, checkOut? }       renombrar o poner fechas
 *   { slug, saved }                      guardar o quitar un alojamiento
 *   { share: true }                      sacar el enlace para compartir
 *   { stopSharing: true }                el enlace deja de servir y salen los invitados (dueña)
 *   { removeMember }                     quitar a un invitado (dueña)
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const t = await getT();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: t("Inicia sesión.") }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    if (typeof body.slug === "string") {
      if (body.saved !== false && !getListingDetail(body.slug)) {
        return NextResponse.json({ error: t("Ese alojamiento ya no existe.") }, { status: 404 });
      }
      const list = setWishlistItem(id, user.id, body.slug, body.saved !== false);
      return NextResponse.json({ list: summarizeWishlist(list, user.id) });
    }
    if (body.share === true) {
      return NextResponse.json({ token: ensureShareToken(id, user.id) });
    }
    if (body.stopSharing === true) {
      return NextResponse.json({ list: summarizeWishlist(resetWishlistSharing(id, user.id), user.id) });
    }
    if (typeof body.removeMember === "string") {
      return NextResponse.json({ list: summarizeWishlist(removeWishlistMember(id, user.id, body.removeMember), user.id) });
    }
    const list = updateWishlist(id, user.id, {
      name: body.name,
      checkIn: body.checkIn === "" ? null : body.checkIn,
      checkOut: body.checkOut === "" ? null : body.checkOut,
    });
    return NextResponse.json({ list: summarizeWishlist(list, user.id) });
  } catch (e) {
    if (e instanceof WishlistError) return NextResponse.json({ error: t(e.message) }, { status: e.status });
    throw e;
  }
}

/** La dueña la borra; un invitado se sale. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const t = await getT();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: t("Inicia sesión.") }, { status: 401 });
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ result: deleteOrLeaveWishlist(id, user.id) });
  } catch (e) {
    if (e instanceof WishlistError) return NextResponse.json({ error: t(e.message) }, { status: e.status });
    throw e;
  }
}
