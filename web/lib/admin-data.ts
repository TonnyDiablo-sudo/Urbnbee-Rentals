import "server-only";
import { listAllUsers, listAllListings, getHostProfile } from "@/lib/marketplace-store";
import { listAllBookings } from "@/lib/bookings-store";
import {
  getVerification,
  hostShowsVerifiedRibbon,
  isHostMembershipActive,
} from "@/lib/verification-store";
import type { BookingStatus } from "@/lib/booking-types";
import { listAllMessages } from "@/lib/host-inbox-store";
import { getAllUserLastSeen, getUserPlaces } from "@/lib/site-visits-store";
import { listUserReports } from "@/lib/user-reports-store";
import { isListingLocationVerified, listAddressProofs } from "@/lib/address-proof-store";
import { listAllDrafts } from "@/lib/associate-drafts-store";
import { listClaimRequests } from "@/lib/listing-claims-store";
import { listAllHostEntitlements } from "@/lib/host-entitlements-store";
import type { HostEntitlementRecord, HostSku } from "@/lib/host-entitlement-types";
import { getMembershipPlan } from "@/lib/membership-plans-store";
import { listAllScreenings } from "@/lib/screening-store";
import type { GuestVerificationRecord } from "@/lib/verification-types";

/** Algo que el usuario compró o tiene activo: membresías, módulos de anfitrión, pases, screenings. */
export type AdminProduct = {
  key: string;
  label: string;
  status: string;
  detail?: string;
  until?: string;
};

export type AdminUserRow = {
  products: AdminProduct[];
  /** Cobrado por sus estancias como anfitrión (pagadas y no reembolsadas). */
  hostRevenueMxn: number;
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
  /** Insignia de anfitrión verificado y de dónde salió. */
  hostVerified: boolean;
  hostVerifiedAt?: string;
  hostVerificationSource?: "identity" | "admin";
  hostMembershipActive: boolean;
  hostRibbon: boolean;
  kycStatus: string;
  bookingPassesRemaining: number;
  associate: boolean;
  phone?: string;
  emailVerified: boolean;
  bookingsAsHost: number;
  threads: number;
  messagesSent: number;
  /** Lo más reciente entre visita, mensaje, reserva o anuncio. */
  lastActiveAt?: string;
  /** "Ciudad, Estado, País" de la última visita con sesión. */
  place?: string;
  openReportsAgainst: number;
  /** Comprobantes de domicilio que la IA dejó por revisar. */
  pendingAddressProofs: number;
  /** Reclamos abiertos sobre sus anuncios. */
  openListingClaims: number;
  provisionedById?: string;
  provisionedAccounts: number;
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
  refundedAt?: string;
  refundAmountMxn?: number;
  createdAt: string;
  updatedAt: string;
  stripeCheckoutSessionId?: string;
  hasContract: boolean;
  contractAccepted: boolean;
  depositMxn: number;
  depositStatus?: string;
  hasPayProof: boolean;
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
  /** Anuncios con insignia cuyo anfitrión no está verificado: herencia del bug viejo. */
  unearnedBadges: number;
  totalBookings: number;
  bookingsByStatus: Record<BookingStatus, number>;
  paidBookings: number;
  refundedBookings: number;
  /** Netos: excluyen lo devuelto al huésped. */
  totalStayRevenueMxn: number;
  totalPlatformFeeMxn: number;
  totalRefundedMxn: number;
  activeVerificationSubscriptions: number;
};

/** Foto del momento para Estadísticas: lo que antes vivía en páginas sueltas del menú. */
export type AdminSnapshot = {
  bookingsByStatus: Partial<Record<BookingStatus, number>>;
  totalBookings: number;
  paidBookings: number;
  refundedBookings: number;
  totalStayRevenueMxn: number;
  totalPlatformFeeMxn: number;
  totalRefundedMxn: number;
  addressProofs: { review: number; pending: number; approved: number; rejected: number; approvedByAi: number };
  locationVerifiedListings: number;
  publishedListings: number;
  listingClaims: { open: number; total: number };
  associates: { associates: number; accounts: number; claimed: number; draftsPending: number; draftsPublished: number };
  identity: { kycVerified: number; hostRibbon: number; activeMemberships: number };
  reports: { open: number; total: number };
};

export function getAdminSnapshot(): AdminSnapshot {
  const o = getAdminOverview();
  const users = listAllUsers();
  const listings = listAllListings();
  const proofs = listAddressProofs();
  const claims = listClaimRequests();
  const drafts = listAllDrafts();
  const reports = listUserReports();
  const count = (s: string) => proofs.filter((p) => p.status === s).length;
  return {
    bookingsByStatus: o.bookingsByStatus,
    totalBookings: o.totalBookings,
    paidBookings: o.paidBookings,
    refundedBookings: o.refundedBookings,
    totalStayRevenueMxn: o.totalStayRevenueMxn,
    totalPlatformFeeMxn: o.totalPlatformFeeMxn,
    totalRefundedMxn: o.totalRefundedMxn,
    addressProofs: {
      review: count("review"),
      pending: count("pending"),
      approved: count("approved"),
      rejected: count("rejected"),
      approvedByAi: proofs.filter((p) => p.status === "approved" && p.reviewedBy === "ai").length,
    },
    locationVerifiedListings: listings.filter((l) => l.published && isListingLocationVerified(l)).length,
    publishedListings: o.publishedListings,
    listingClaims: { open: claims.filter((c) => c.status === "open").length, total: claims.length },
    associates: {
      associates: users.filter((u) => u.associate).length,
      accounts: users.filter((u) => u.provisionedBy).length,
      claimed: users.filter((u) => u.provisionedBy && u.claimedAt).length,
      draftsPending: drafts.filter((d) => d.status === "pending").length,
      draftsPublished: drafts.filter((d) => d.status === "published").length,
    },
    identity: {
      kycVerified: users.filter((u) => getVerification(u.id)?.kycStatus === "verified").length,
      hostRibbon: users.filter((u) => hostShowsVerifiedRibbon(u.id)).length,
      activeMemberships: o.activeVerificationSubscriptions,
    },
    reports: {
      open: reports.filter((r) => r.status === "open" || r.status === "in_review").length,
      total: reports.length,
    },
  };
}

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
  let refundedBookings = 0;
  let totalStayRevenueMxn = 0;
  let totalPlatformFeeMxn = 0;
  let totalRefundedMxn = 0;

  for (const b of bookings) {
    byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
    if (!b.paidAt) continue;
    if (b.refundedAt) {
      refundedBookings++;
      totalRefundedMxn += b.refundAmountMxn ?? b.estimatedTotalMxn + (b.platformFeeMxn ?? 0);
      continue;
    }
    paidBookings++;
    totalStayRevenueMxn += b.estimatedTotalMxn;
    totalPlatformFeeMxn += b.platformFeeMxn ?? 0;
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
    verifiedListings: listings.filter((l) => hostShowsVerifiedRibbon(l.hostId)).length,
    unearnedBadges: listings.filter(
      (l) => l.verified && !hostShowsVerifiedRibbon(l.hostId)
    ).length,
    totalBookings: bookings.length,
    bookingsByStatus: byStatus,
    paidBookings,
    refundedBookings,
    totalStayRevenueMxn,
    totalPlatformFeeMxn,
    totalRefundedMxn,
    activeVerificationSubscriptions,
  };
}

const SKU_LABEL: Record<HostSku, string> = {
  cabibee_booking_engine: "Motor de reservas",
  cabibee_host_verification: "Verificación de anfitrión",
  cabibee_cleaning_tool: "Limpieza",
  cabibee_collaborators: "Colaboradores",
  cabibee_address_proof: "Comprobante de domicilio",
  cabibee_featured_listing: "Anuncio destacado",
};

const SUB_LIVE = new Set(["active", "trialing", "past_due"]);

function productsOf(v: GuestVerificationRecord | undefined, ents: HostEntitlementRecord[], screenings: number): AdminProduct[] {
  const out: AdminProduct[] = [];
  const plan = (code?: string) => (code ? getMembershipPlan(code)?.label : undefined);
  if (v && SUB_LIVE.has(v.subscriptionStatus)) {
    out.push({ key: "guest_membership", label: "Membresía de huésped", status: v.subscriptionStatus, detail: plan(v.planCode), until: v.currentPeriodEnd });
  }
  if (v?.hostSubscriptionStatus && SUB_LIVE.has(v.hostSubscriptionStatus)) {
    out.push({ key: "host_membership", label: "Membresía de anfitrión", status: v.hostSubscriptionStatus, until: v.hostCurrentPeriodEnd });
  }
  for (const e of ents) {
    if (e.status === "cancelled") continue;
    out.push({
      key: e.sku,
      label: SKU_LABEL[e.sku] ?? e.sku,
      status: e.cancelAtPeriodEnd ? "cancela al vencer" : e.status,
      detail: [plan(e.planCode), e.quantity ? `${e.quantity} u.` : undefined, e.source === "urbnbeeai_seller" ? "vía UrbnbeeAI" : undefined]
        .filter(Boolean)
        .join(" · ") || undefined,
      until: e.currentPeriodEnd,
    });
  }
  if (v?.bookingPassesRemaining) {
    out.push({ key: "booking_pass", label: "Pases de reserva", status: "active", detail: `${v.bookingPassesRemaining} sin usar` });
  }
  if (screenings) out.push({ key: "screening", label: "Screening de huésped", status: "active", detail: `${screenings} pagado${screenings !== 1 ? "s" : ""}` });
  return out;
}

export function getAdminUsers(): AdminUserRow[] {
  const users = listAllUsers();
  const listings = listAllListings();
  const bookings = listAllBookings();
  const lastSeen = getAllUserLastSeen();
  const places = getUserPlaces();

  const latest = new Map<string, string>();
  const touch = (id: string | undefined, at: string | undefined) => {
    if (!id || !at) return;
    const prev = latest.get(id);
    if (!prev || at > prev) latest.set(id, at);
  };
  const threadKeys = new Map<string, Set<string>>();
  const sent = new Map<string, number>();
  for (const m of listAllMessages()) {
    const guestId = m.guestSessionId.startsWith("gu_") ? m.guestSessionId.slice(3) : undefined;
    const key = `${m.listingId}:${m.guestSessionId}`;
    for (const id of [m.hostId, guestId]) {
      if (!id) continue;
      const set = threadKeys.get(id) ?? new Set<string>();
      set.add(key);
      threadKeys.set(id, set);
    }
    const author = m.sender === "host" ? m.hostId : guestId;
    if (author) {
      sent.set(author, (sent.get(author) ?? 0) + 1);
      touch(author, m.createdAt);
    }
  }
  for (const b of bookings) {
    touch(b.guestUserId, b.updatedAt);
    touch(b.hostId, b.updatedAt);
  }
  for (const l of listings) touch(l.hostId, l.updatedAt);
  for (const [id, at] of Object.entries(lastSeen)) touch(id, at);

  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  const proofsPending = new Map<string, number>();
  for (const p of listAddressProofs()) if (p.status === "review" || p.status === "pending") bump(proofsPending, p.hostId);
  const claimsOpen = new Map<string, number>();
  for (const c of listClaimRequests()) if (c.status === "open") bump(claimsOpen, c.hostId);
  const provisioned = new Map<string, number>();
  for (const u of users) if (u.provisionedBy) bump(provisioned, u.provisionedBy);

  const entitlementsBy = new Map<string, HostEntitlementRecord[]>();
  for (const e of listAllHostEntitlements()) entitlementsBy.set(e.hostId, [...(entitlementsBy.get(e.hostId) ?? []), e]);
  const screeningsBy = new Map<string, number>();
  for (const s of listAllScreenings()) {
    if (!s.paidAt) continue;
    bump(screeningsBy, s.paidByUserId ?? (s.payer === "host" ? s.hostId ?? "" : s.guestUserId));
  }

  const openAgainst = new Map<string, number>();
  for (const r of listUserReports()) {
    if (r.targetUserId && (r.status === "open" || r.status === "in_review")) {
      openAgainst.set(r.targetUserId, (openAgainst.get(r.targetUserId) ?? 0) + 1);
    }
  }

  return users.map((u) => {
    const userListings = listings.filter((l) => l.hostId === u.id);
    const userBookings = bookings.filter((b) => b.guestUserId === u.id);
    const placeParts = (places[u.id] ?? "").split("|").filter((p) => p && p !== "Desconocido");
    const paidBookings = userBookings.filter((b) => !!b.paidAt && !b.refundedAt);
    const totalPaidMxn = paidBookings.reduce((s, b) => s + b.estimatedTotalMxn, 0);
    const platformFeePaidMxn = paidBookings.reduce((s, b) => s + (b.platformFeeMxn ?? 0), 0);
    const v = getVerification(u.id);
    const hostPaid = bookings.filter((b) => b.hostId === u.id && b.paidAt && !b.refundedAt);
    return {
      products: productsOf(v, entitlementsBy.get(u.id) ?? [], screeningsBy.get(u.id) ?? 0),
      hostRevenueMxn: hostPaid.reduce((s, b) => s + b.estimatedTotalMxn, 0),
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
      hostVerified: Boolean(v?.hostVerifiedAt),
      hostVerifiedAt: v?.hostVerifiedAt,
      hostVerificationSource: v?.hostVerificationSource,
      hostMembershipActive: isHostMembershipActive(u.id),
      hostRibbon: hostShowsVerifiedRibbon(u.id),
      kycStatus: v?.kycStatus ?? "not_started",
      bookingPassesRemaining: v?.bookingPassesRemaining ?? 0,
      associate: Boolean(u.associate),
      phone: u.phone || getHostProfile(u.id)?.phone || undefined,
      emailVerified: Boolean(u.emailVerifiedAt),
      bookingsAsHost: bookings.filter((b) => b.hostId === u.id).length,
      threads: threadKeys.get(u.id)?.size ?? 0,
      messagesSent: sent.get(u.id) ?? 0,
      lastActiveAt: latest.get(u.id),
      place: placeParts.length ? placeParts.reverse().join(", ") : undefined,
      openReportsAgainst: openAgainst.get(u.id) ?? 0,
      pendingAddressProofs: proofsPending.get(u.id) ?? 0,
      openListingClaims: claimsOpen.get(u.id) ?? 0,
      provisionedById: u.provisionedBy,
      provisionedAccounts: provisioned.get(u.id) ?? 0,
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
      refundedAt: b.refundedAt,
      refundAmountMxn: b.refundAmountMxn,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      stripeCheckoutSessionId: b.stripeCheckoutSessionId,
      hasContract: Boolean(b.contract),
      contractAccepted: Boolean(b.contract?.hostAcceptedAt && b.contract?.guestAcceptedAt),
      depositMxn: b.deposit?.amountMxn ?? b.contract?.snapshot.depositMxn ?? 0,
      depositStatus: b.deposit?.status,
      hasPayProof: Boolean(b.payProof),
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
    PENDING_HOST: "Pago recibido — pendiente de aprobación del anfitrión",
    AWAITING_DETAILS: "En espera de datos del huésped",
    CONFIRMED: "Reserva confirmada",
    REJECTED: "Reserva rechazada",
    CANCELLED: "Reserva cancelada",
    COMPLETED: "Reserva completada",
    EXPIRED: "Reserva expirada — no se pagó a tiempo",
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

    if (b.refundedAt) {
      logs.push({
        id: `${b.id}-refunded`,
        when: b.refundedAt,
        event: "Reembolso emitido al huésped",
        detail,
        entityType: "booking" as const,
        entityId: b.id,
        meta: {
          refundMxn: b.refundAmountMxn,
          refundReason: b.refundReason,
          stripeRefund: b.stripeRefundId,
        },
      });
    }

    if (b.contract) {
      logs.push({
        id: `${b.id}-contract`,
        when: b.contract.generatedAt,
        event: "Contrato de reserva generado",
        detail: `${detail} · ${b.contract.templateId}`,
        entityType: "booking" as const,
        entityId: b.id,
        meta: { token: b.token, template: b.contract.templateId },
      });
      if (b.contract.guestAcceptedAt) {
        logs.push({
          id: `${b.id}-contract-guest`,
          when: b.contract.guestAcceptedAt,
          event: "Huésped aceptó el contrato",
          detail: `${b.contract.guestAcceptedName ?? guest?.email ?? b.guestEmail} · IP ${b.contract.guestAcceptedIp ?? "—"}`,
          entityType: "booking" as const,
          entityId: b.id,
          meta: { token: b.token },
        });
      }
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
