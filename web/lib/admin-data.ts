import "server-only";
import { listAllUsers, listAllListings, getHostProfile } from "@/lib/marketplace-store";
import { listAllBookings } from "@/lib/bookings-store";
import { getVerification } from "@/lib/verification-store";
import type { BookingStatus } from "@/lib/booking-types";

export type AdminUserRow = {
  id: string;
  email: string;
  fullName: string;
  role: "guest" | "host" | "admin";
  createdAt: string;
  listingsCount: number;
  listingsPublished: number;
  bookingsAsGuest: number;
  bookingsPaid: number;
  totalPaidMxn: number;
  platformFeePaidMxn: number;
  verificationStatus: string;
  hasStripeCustomer: boolean;
  subscriptionPeriodEnd?: string;
};

export type AdminBookingRow = {
  id: string;
  token: string;
  status: BookingStatus;
  listingId: string;
  listingTitle?: string;
  hostId: string;
  hostEmail?: string;
  hostName?: string;
  guestUserId?: string;
  guestEmail: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  estimatedTotalMxn: number;
  platformFeeMxn: number;
  totalChargeMxn: number;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  stripeCheckoutSessionId?: string;
};

export type AdminOverview = {
  totalUsers: number;
  totalGuests: number;
  totalHosts: number;
  totalAdmins: number;
  totalListings: number;
  publishedListings: number;
  draftListings: number;
  verifiedListings: number;
  totalBookings: number;
  bookingsByStatus: Record<BookingStatus, number>;
  paidBookings: number;
  totalStayRevenueMxn: number;
  totalPlatformFeeMxn: number;
  activeVerificationSubscriptions: number;
};

export type AdminLogRow = {
  id: string;
  when: string;
  event: string;
  detail: string;
  entityType: "booking" | "verification" | "user";
  entityId: string;
  meta?: Record<string, string | number | undefined>;
};

export function getAdminOverview(): AdminOverview {
  const users = listAllUsers();
  const listings = listAllListings();
  const bookings = listAllBookings();

  const totalGuests = users.filter((u) => u.role === "guest").length;
  const totalHosts = users.filter((u) => u.role === "host").length;
  const totalAdmins = users.filter((u) => u.role === "admin").length;

  const byStatus = {} as Record<BookingStatus, number>;
  let paidBookings = 0;
  let totalStayRevenueMxn = 0;
  let totalPlatformFeeMxn = 0;

  for (const b of bookings) {
    byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
    if (b.paidAt) {
      paidBookings++;
      totalStayRevenueMxn += b.estimatedTotalMxn;
      totalPlatformFeeMxn += b.platformFeeMxn ?? 0;
    }
  }

  let activeVerificationSubscriptions = 0;
  for (const u of users) {
    const v = getVerification(u.id);
    if (v?.subscriptionStatus === "active" || v?.subscriptionStatus === "trialing") {
      activeVerificationSubscriptions++;
    }
  }

  return {
    totalUsers: users.length,
    totalGuests,
    totalHosts,
    totalAdmins,
    totalListings: listings.length,
    publishedListings: listings.filter((l) => l.published).length,
    draftListings: listings.filter((l) => !l.published).length,
    verifiedListings: listings.filter((l) => l.verified).length,
    totalBookings: bookings.length,
    bookingsByStatus: byStatus,
    paidBookings,
    totalStayRevenueMxn,
    totalPlatformFeeMxn,
    activeVerificationSubscriptions,
  };
}

export function getAdminUsers(): AdminUserRow[] {
  const users = listAllUsers();
  const listings = listAllListings();
  const bookings = listAllBookings();

  return users.map((u) => {
    const userListings = listings.filter((l) => l.hostId === u.id);
    const userBookings = bookings.filter((b) => b.guestUserId === u.id);
    const paidBookings = userBookings.filter((b) => !!b.paidAt);
    const totalPaidMxn = paidBookings.reduce((s, b) => s + b.estimatedTotalMxn, 0);
    const platformFeePaidMxn = paidBookings.reduce((s, b) => s + (b.platformFeeMxn ?? 0), 0);
    const v = getVerification(u.id);
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      createdAt: u.createdAt,
      listingsCount: userListings.length,
      listingsPublished: userListings.filter((l) => l.published).length,
      bookingsAsGuest: userBookings.length,
      bookingsPaid: paidBookings.length,
      totalPaidMxn,
      platformFeePaidMxn,
      verificationStatus: v?.subscriptionStatus ?? "none",
      hasStripeCustomer: !!v?.stripeCustomerId,
      subscriptionPeriodEnd: v?.currentPeriodEnd,
    };
  });
}

export function getAdminBookings(): AdminBookingRow[] {
  const bookings = listAllBookings();
  const listings = listAllListings();
  const users = listAllUsers();

  const listingMap = new Map(listings.map((l) => [l.id, l]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  return bookings.map((b) => {
    const listing = listingMap.get(b.listingId);
    const host = userMap.get(b.hostId);
    const guest = b.guestUserId ? userMap.get(b.guestUserId) : undefined;
    return {
      id: b.id,
      token: b.token,
      status: b.status,
      listingId: b.listingId,
      listingTitle: listing?.title,
      hostId: b.hostId,
      hostEmail: host?.email,
      hostName: host?.fullName,
      guestUserId: b.guestUserId,
      guestEmail: guest?.email ?? b.guestEmail,
      guestName: guest?.fullName ?? b.guestName,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      nights: b.nights,
      estimatedTotalMxn: b.estimatedTotalMxn,
      platformFeeMxn: b.platformFeeMxn ?? 0,
      totalChargeMxn: b.estimatedTotalMxn + (b.platformFeeMxn ?? 0),
      paidAt: b.paidAt,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      stripeCheckoutSessionId: b.stripeCheckoutSessionId,
    };
  });
}

export function getAdminLogs(limit = 200): AdminLogRow[] {
  const bookings = listAllBookings();
  const users = listAllUsers();
  const userMap = new Map(users.map((u) => [u.id, u]));
  const logs: AdminLogRow[] = [];

  const statusLabel: Record<string, string> = {
    AWAITING_PAYMENT: "Reserva creada — esperando pago",
    PENDING: "Pago recibido — pendiente de aprobación del anfitrión",
    AWAITING_DETAILS: "En espera de datos del huésped",
    CONFIRMED: "Reserva confirmada",
    REJECTED: "Reserva rechazada",
    CANCELLED: "Reserva cancelada",
    COMPLETED: "Reserva completada",
  };

  for (const b of bookings) {
    const guest = b.guestUserId ? userMap.get(b.guestUserId) : undefined;
    const label = statusLabel[b.status] ?? b.status;
    const detail =
      `${guest?.email ?? b.guestEmail} · ${b.checkIn} → ${b.checkOut} · $${(b.estimatedTotalMxn + (b.platformFeeMxn ?? 0)).toLocaleString("es-MX")} MXN`;

    logs.push({
      id: `${b.id}-latest`,
      when: b.updatedAt,
      event: label,
      detail,
      entityType: "booking" as const,
      entityId: b.id,
      meta: {
        status: b.status,
        stayMxn: b.estimatedTotalMxn,
        feeMxn: b.platformFeeMxn ?? 0,
        token: b.token,
      },
    });

    if (b.paidAt && b.paidAt !== b.updatedAt) {
      logs.push({
        id: `${b.id}-paid`,
        when: b.paidAt,
        event: "Pago procesado en Stripe",
        detail,
        entityType: "booking" as const,
        entityId: b.id,
        meta: {
          stayMxn: b.estimatedTotalMxn,
          feeMxn: b.platformFeeMxn ?? 0,
          stripeSession: b.stripeCheckoutSessionId,
        },
      });
    }

    logs.push({
      id: `${b.id}-created`,
      when: b.createdAt,
      event: "Solicitud de reserva recibida",
      detail,
      entityType: "booking" as const,
      entityId: b.id,
      meta: { nights: b.nights, listing: b.listingId },
    });
  }

  // Verification events
  for (const u of users) {
    const v = getVerification(u.id);
    if (!v) continue;
    if (v.subscriptionStatus !== "none") {
      logs.push({
        id: `verif-${u.id}`,
        when: v.updatedAt,
        event: `Verificación de huésped: ${v.subscriptionStatus}`,
        detail: `${u.email} · ${v.subscriptionStatus}`,
        entityType: "verification" as const,
        entityId: u.id,
        meta: {
          status: v.subscriptionStatus,
          periodEnd: v.currentPeriodEnd,
        },
      });
    }
  }

  logs.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
  return logs.slice(0, limit);
}
