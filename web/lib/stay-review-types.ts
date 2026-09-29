export type StayReviewKind = "guest_to_listing" | "host_to_guest";

export type StayReviewRecord = {
  id: string;
  bookingId: string;
  listingId: string;
  hostId: string;
  guestUserId: string;
  kind: StayReviewKind;
  authorUserId: string;
  rating: number;
  comment: string;
  createdAt: string;
};
