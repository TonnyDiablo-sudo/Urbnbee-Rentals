export type StayReviewKind = "guest_to_listing" | "host_to_guest";

/** Sin `status` es una reseña publicada (las viejas no lo tienen). */
export type StayReviewStatus = "published" | "pending" | "rejected";

export type StayReviewRecord = {
  id: string;
  bookingId: string;
  listingId: string;
  hostId: string;
  guestUserId: string;
  kind: StayReviewKind;
  authorUserId: string;
  /** Estrellas enteras (la global redondeada), para mostrar. */
  rating: number;
  /** Calificación global exacta: promedio de las categorías. Las viejas no la tienen. */
  score?: number;
  /** Calificación de 1 a 5 por categoría (limpieza, seguridad…). */
  categories?: Record<string, number>;
  comment: string;
  createdAt: string;
  status?: StayReviewStatus;
  /** Por qué no se publicó; se le muestra a quien la escribió. */
  statusReason?: string;
  reviewAttempts?: number;
  reviewedAt?: string;
  /** Quién decidió: el filtro o una persona del equipo. */
  reviewedBy?: "auto" | "team";
};

export function isPublishedReview(r: Pick<StayReviewRecord, "status"> | undefined | null): boolean {
  return Boolean(r) && (r!.status === undefined || r!.status === "published");
}
