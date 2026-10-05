import "server-only";
import { stayHasEnded } from "@/lib/booking-deposit";
import type { BookingRecord } from "@/lib/booking-types";
import { publicNameOf } from "@/lib/display-name";
import { findUserById, getHostProfile } from "@/lib/marketplace-store";
import type { Review } from "@/lib/listing-detail-data";
import { notifyGuestNewReview, notifyHostNewReview } from "@/lib/push";
import type { Lang } from "@/lib/i18n";
import { moderateReview } from "@/lib/review-moderation";
import { getBookingById } from "@/lib/bookings-store";
import {
  findStayReview,
  insertStayReview,
  listListingStayReviews,
  listStayReviews,
  patchStayReview,
  removeStayReview,
} from "@/lib/stay-reviews-store";
import { isPublishedReview, type StayReviewKind, type StayReviewRecord } from "@/lib/stay-review-types";

export function stayReviewEligible(booking: BookingRecord): boolean {
  if (!booking.paidAt || booking.refundedAt) return false;
  if (booking.status !== "COMPLETED" && booking.status !== "CONFIRMED") return false;
  return stayHasEnded(booking);
}

/**
 * Con `viewer`, la reseña propia sale en cualquier estado (para mostrar «en revisión»)
 * y la del otro lado sólo si ya está publicada.
 */
export function reviewsForBooking(
  bookingId: string,
  viewer?: "guest" | "host"
): {
  guestToListing?: StayReviewRecord;
  hostToGuest?: StayReviewRecord;
} {
  const guestToListing = findStayReview(bookingId, "guest_to_listing");
  const hostToGuest = findStayReview(bookingId, "host_to_guest");
  if (!viewer) return { guestToListing, hostToGuest };
  return {
    guestToListing: viewer === "guest" || isPublishedReview(guestToListing) ? guestToListing : undefined,
    hostToGuest: viewer === "host" || isPublishedReview(hostToGuest) ? hostToGuest : undefined,
  };
}

function notifyPublished(review: StayReviewRecord, booking: BookingRecord | undefined) {
  if (review.kind === "guest_to_listing") {
    notifyHostNewReview({
      hostId: review.hostId,
      listingId: review.listingId,
      guestName: findUserById(review.authorUserId)?.fullName?.trim() || booking?.guestName || "",
      rating: review.rating,
    });
  } else {
    const host = findUserById(review.hostId);
    notifyGuestNewReview({
      guestUserId: review.guestUserId,
      listingId: review.listingId,
      hostName: (host && publicNameOf(host)) || "Tu anfitrión",
      rating: review.rating,
    });
  }
}

export const REVIEW_PENDING_MESSAGE = "Gracias. Tu reseña está siendo revisada por nuestro equipo y se publicará en cuanto quede aprobada.";

export async function createStayReview(opts: {
  booking: BookingRecord;
  authorUserId: string;
  kind: StayReviewKind;
  rating: number;
  comment: string;
  lang?: Lang;
}): Promise<{ review?: StayReviewRecord; error?: string; status?: number; pending?: boolean; message?: string }> {
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
  const previous = findStayReview(booking.id, kind);
  if (previous && previous.status !== "rejected") {
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

  const check = await moderateReview({ kind, rating: stars, comment: text, lang: opts.lang ?? "es" });
  if (check.verdict === "reject") {
    return { error: check.reason ?? "Tu reseña no cumple las reglas de la comunidad.", status: 422 };
  }
  const again = findStayReview(booking.id, kind);
  if (again && again.status !== "rejected") {
    return { error: "Ya dejaste tu reseña de esta estancia.", status: 409 };
  }
  if (again) removeStayReview(again.id);

  const pending = check.verdict === "unavailable";
  const review = insertStayReview({
    bookingId: booking.id,
    listingId: booking.hostAdjustedListingId ?? booking.listingId,
    hostId: booking.hostId,
    guestUserId: booking.guestUserId,
    kind,
    authorUserId,
    rating: stars,
    comment: text,
    status: pending ? "pending" : "published",
    reviewAttempts: 1,
    ...(pending ? {} : { reviewedAt: new Date().toISOString(), reviewedBy: "auto" as const }),
  });
  if (pending) return { review, pending: true, message: REVIEW_PENDING_MESSAGE };
  notifyPublished(review, booking);
  return { review };
}

/** Publica o rechaza una reseña en revisión (lo usa el reintento automático y el equipo). */
export function decidePendingReview(
  id: string,
  decision: "published" | "rejected",
  opts: { by: "auto" | "team"; reason?: string }
): StayReviewRecord | undefined {
  const row = listStayReviews().find((r) => r.id === id);
  if (!row || row.status !== "pending") return undefined;
  const next = patchStayReview(id, {
    status: decision,
    statusReason: decision === "rejected" ? opts.reason || "Tu reseña no cumple las reglas de la comunidad." : undefined,
    reviewedAt: new Date().toISOString(),
    reviewedBy: opts.by,
  });
  if (next && decision === "published") notifyPublished(next, getBookingById(next.bookingId));
  return next;
}

/** Vuelve a revisar las reseñas que quedaron pendientes porque el filtro no respondió. */
export async function retryPendingReviews(): Promise<number> {
  let done = 0;
  for (const r of listStayReviews()) {
    if (r.status !== "pending") continue;
    const author = findUserById(r.authorUserId);
    const check = await moderateReview({
      kind: r.kind,
      rating: r.rating,
      comment: r.comment,
      lang: author?.lang === "en" ? "en" : "es",
    });
    if (check.verdict === "unavailable") {
      patchStayReview(r.id, { reviewAttempts: (r.reviewAttempts ?? 1) + 1 });
      continue;
    }
    decidePendingReview(r.id, check.verdict === "approve" ? "published" : "rejected", { by: "auto", reason: check.reason });
    done++;
  }
  return done;
}

let retryStarted = false;
export function startReviewModerationWorker() {
  if (retryStarted) return;
  retryStarted = true;
  const tick = () => {
    retryPendingReviews().catch((e) => console.warn("[review moderation retry]", e));
  };
  setTimeout(tick, 90_000);
  setInterval(tick, 15 * 60 * 1000);
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
