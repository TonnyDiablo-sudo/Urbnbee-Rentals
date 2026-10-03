import "server-only";
import { publicNameOf } from "@/lib/display-name";
import { getListingDetail } from "@/lib/get-listing-detail";
import { findUserById } from "@/lib/marketplace-store";
import type { Wishlist } from "@/lib/wishlists-store";

export type WishlistPerson = { id: string; name: string; owner: boolean };

export type WishlistSummary = {
  id: string;
  name: string;
  isOwner: boolean;
  checkIn?: string;
  checkOut?: string;
  slugs: string[];
  covers: string[];
  people: WishlistPerson[];
  shared: boolean;
};

function firstName(userId: string): string {
  const name = publicNameOf(findUserById(userId));
  return name.split(/\s+/)[0] || "Invitado";
}

export function wishlistPeople(list: Wishlist): WishlistPerson[] {
  return [list.ownerId, ...list.memberIds].map((id, i) => ({ id, name: firstName(id), owner: i === 0 }));
}

/** Sólo los alojamientos que siguen publicados. */
export function liveSlugs(list: Wishlist): string[] {
  return list.items.map((i) => i.slug).filter((slug) => Boolean(getListingDetail(slug)));
}

export function summarizeWishlist(list: Wishlist, userId: string): WishlistSummary {
  const slugs = liveSlugs(list);
  return {
    id: list.id,
    name: list.name,
    isOwner: list.ownerId === userId,
    checkIn: list.checkIn,
    checkOut: list.checkOut,
    slugs,
    covers: slugs
      .slice(0, 3)
      .map((s) => getListingDetail(s)?.photos[0] ?? "")
      .filter(Boolean),
    people: wishlistPeople(list),
    shared: Boolean(list.shareToken) || list.memberIds.length > 0,
  };
}

export function addedByName(list: Wishlist, slug: string, viewerId: string): string | null {
  const item = list.items.find((i) => i.slug === slug);
  if (!item || (list.memberIds.length === 0 && item.addedBy === list.ownerId)) return null;
  return item.addedBy === viewerId ? "Tú" : firstName(item.addedBy);
}
