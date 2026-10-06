import "server-only";
import { publicNameOf } from "@/lib/display-name";
import { findUserById, getHostProfile, listListingsForHost } from "@/lib/marketplace-store";
import { isPublishedReview } from "@/lib/stay-review-types";
import { listListingStayReviews, listStayReviews, listingStayRating } from "@/lib/stay-reviews-store";
import { isHostIdentityVerified } from "@/lib/verification-store";

export type PublicProfile = {
  id: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  work?: string;
  livesIn?: string;
  languages: string[];
  interests: string[];
  memberSince?: string;
  identityVerified: boolean;
  listings: { id: string; title: string; slug: string; photo?: string; city?: string; rating: number; reviews: number }[];
  /** Huésped → anuncios del anfitrión, o anfitriones → este huésped. */
  reviews: { id: string; author: string; avatarUrl?: string; rating: number; comment: string; date: string }[];
  rating: { avg: number; count: number };
};

const MAX_REVIEWS = 12;

/** Lo que cualquiera puede ver de una cuenta: sin correo, teléfono ni apellidos ocultos por alias. */
export function publicProfileOf(userId: string): PublicProfile | null {
  const user = findUserById(userId);
  if (!user) return null;
  const p = getHostProfile(userId);
  const listings = listListingsForHost(userId)
    .filter((l) => l.published && l.slug)
    .map((l) => {
      const r = listingStayRating(l.id);
      return { id: l.id, title: l.title, slug: l.slug, photo: l.photos?.[0], city: l.city, rating: r.avg, reviews: r.count };
    });

  const raw = listings.length
    ? listings.flatMap((l) => listListingStayReviews(l.id))
    : listStayReviews().filter((r) => r.kind === "host_to_guest" && r.guestUserId === userId && isPublishedReview(r));
  raw.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const count = raw.length;
  const avg = count ? raw.reduce((s, r) => s + (r.score ?? r.rating), 0) / count : 0;

  return {
    id: user.id,
    name: publicNameOf(user) || "Usuario",
    avatarUrl: p?.avatarUrl || undefined,
    bio: p?.bio?.trim() || undefined,
    work: p?.work?.trim() || undefined,
    livesIn: p?.livesIn?.trim() || undefined,
    languages: p?.languages ?? [],
    interests: p?.interests ?? [],
    memberSince: user.createdAt,
    identityVerified: isHostIdentityVerified(user.id),
    listings,
    rating: { avg, count },
    reviews: raw.slice(0, MAX_REVIEWS).map((r) => {
      const author = findUserById(r.authorUserId);
      return {
        id: r.id,
        author: (author && publicNameOf(author)) || "Usuario",
        avatarUrl: getHostProfile(r.authorUserId)?.avatarUrl || undefined,
        rating: r.rating,
        comment: r.comment,
        date: r.createdAt.slice(0, 10),
      };
    }),
  };
}
