import "server-only";
import { stayHasEnded } from "@/lib/booking-deposit";
import type { BookingRecord } from "@/lib/booking-types";
import { publicNameOf } from "@/lib/display-name";
import { findUserById, getHostProfile } from "@/lib/marketplace-store";
import type { Review } from "@/lib/listing-detail-data";
import { notifyGuestNewReview, notifyHostNewReview } from "@/lib/push";
import {
  findStayReview,
  insertStayReview,
  listListingStayReviews,
} from "@/lib/stay-reviews-store";
import type { StayReviewKind, StayReviewRecord } from "@/lib/stay-review-types";

export function stayReviewEligible(booking: BookingRecord): boolean {
  if (!booking.paidAt || booking.refundedAt) return false;
  if (booking.status !== "COMPLETED" && booking.status !== "CONFIRMED") return false;
  return stayHasEnded(booking);
}

export function reviewsForBooking(bookingId: string): {
  guestToListing?: StayReviewRecord;
  hostToGuest?: StayReviewRecord;
} {
  return {
    guestToListing: findStayReview(bookingId, "guest_to_listing"),
    hostToGuest: findStayReview(bookingId, "host_to_guest"),
  };
}

export function createStayReview(opts: {
  booking: BookingRecord;
  authorUserId: string;
  kind: StayReviewKind;
  rating: number;
  comment: string;
}): { review?: StayReviewRecord; error?: string; status?: number } {
  const { booking, authorUserId, kind, rating, comment } = opts;
  if (!stayReviewEligible(booking)) {
    return { error: "La reseña se abre cuando termina la estancia.", status: 409 };
  }
  if (!booking.guestUserId) {
    return { error: "Esta reserva no tiene huésped de cuenta.", status: 409 };
  }

  if (kind === "guest_to_listing" && authorUserId !== booking.guestUserId) {
    return { error: "Solo el huésped de esta reserva puede reseñar el alojamiento.", status: 403 };
  }
  if (kind === "host_to_guest" && authorUserId !== booking.hostId) {
    return { error: "Solo el anfitrión de esta reserva puede reseñar al huésped.", status: 403 };
  }
  if (findStayReview(booking.id, kind)) {
    return { error: "Ya dejaste tu reseña de esta estancia.", status: 409 };
  }

  const stars = Math.round(Number(rating));
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return { error: "La calificación va de 1 a 5.", status: 400 };
  }
  const text = comment.replace(/[<>]/g, "").trim().slice(0, 2000);
  if (text.length < 10) {
    return { error: "Escribe al menos 10 caracteres.", status: 400 };
  }

  const listingId = booking.hostAdjustedListingId ?? booking.listingId;
  const review = insertStayReview({
    bookingId: booking.id,
    listingId,
    hostId: booking.hostId,
    guestUserId: booking.guestUserId,
    kind,
    authorUserId,
    rating: stars,
    comment: text,
  });
  if (kind === "guest_to_listing") {
    notifyHostNewReview({
      hostId: booking.hostId,
      listingId,
      guestName: findUserById(authorUserId)?.fullName?.trim() || booking.guestName,
      rating: stars,
    });
  } else {
    const host = findUserById(booking.hostId);
    notifyGuestNewReview({
      guestUserId: booking.guestUserId,
      listingId,
      hostName: (host && publicNameOf(host)) || "Tu anfitrión",
      rating: stars,
    });
  }
  return { review };
}

export function listingReviewsForPublic(listingId: string): Review[] {
  return listListingStayReviews(listingId).map((r) => {
    const author = findUserById(r.authorUserId);
    const profile = getHostProfile(r.authorUserId);
    return {
      id: r.id,
      author: (author && publicNameOf(author)) || "Huésped",
      avatarUrl:
        profile?.avatarUrl ||
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&q=80",
      rating: r.rating,
      date: r.createdAt.slice(0, 10),
      comment: r.comment,
      fromStay: true,
    };
  });
}
