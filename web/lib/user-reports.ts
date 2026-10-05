import "server-only";
import { listBookingsForGuest, listBookingsForHost } from "@/lib/bookings-store";
import { nameForViewer, shareABooking } from "@/lib/display-name";
import { guestSessionIdForUser, listAllMessages } from "@/lib/host-inbox-store";
import { findUserByEmail, findUserById, getListingById, getListingBySlug } from "@/lib/marketplace-store";
import type { UserRecord } from "@/lib/marketplace-types";
import { notifyUser } from "@/lib/push";
import {
  countRecentReportsBy,
  createUserReport,
  findUserReport,
  listReportsByReporter,
  updateUserReport,
} from "@/lib/user-reports-store";
import {
  REPORT_CATEGORIES,
  REPORT_KINDS,
  REPORT_STATUS_LABEL,
  type MyReportView,
  type ReportCounterpart,
  type UserReportRecord,
  type UserReportStatus,
} from "@/lib/user-reports-types";

const MAX_PER_DAY = 10;
export const REPORT_MESSAGE_MAX = 4000;

/** Anfitriones y huéspedes con los que hubo reserva o chat. */
export function listReportCounterparts(userId: string): ReportCounterpart[] {
  const out = new Map<string, ReportCounterpart>();
  const add = (c: ReportCounterpart) => {
    if (!c.userId || c.userId === userId) return;
    const key = `${c.userId}:${c.relation}`;
    if (!out.has(key)) out.set(key, c);
  };
  const title = (listingId: string) => getListingById(listingId)?.title;

  for (const b of listBookingsForGuest(userId)) {
    add({ userId: b.hostId, name: nameForViewer(b.hostId, true), relation: "host", listingId: b.listingId, listingTitle: title(b.listingId) });
  }
  for (const b of listBookingsForHost(userId)) {
    if (!b.guestUserId) continue;
    add({ userId: b.guestUserId, name: nameForViewer(b.guestUserId, true), relation: "guest", listingId: b.listingId, listingTitle: title(b.listingId) });
  }
  const mySid = guestSessionIdForUser(userId);
  for (const m of listAllMessages()) {
    if (m.guestSessionId === mySid) {
      add({ userId: m.hostId, name: nameForViewer(m.hostId, shareABooking(m.hostId, userId)), relation: "host", listingId: m.listingId, listingTitle: title(m.listingId) });
    } else if (m.hostId === userId && m.guestSessionId.startsWith("gu_")) {
      const guestId = m.guestSessionId.slice(3);
      add({ userId: guestId, name: nameForViewer(guestId, shareABooking(userId, guestId)), relation: "guest", listingId: m.listingId, listingTitle: title(m.listingId) });
    }
  }
  return [...out.values()].filter((c) => c.name).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Correo exacto o liga de un anuncio de Cabibee → cuenta. */
function resolveTargetFromLabel(label: string): { userId?: string; listingId?: string } {
  const text = label.trim();
  if (!text) return {};
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    const u = findUserByEmail(text);
    return u ? { userId: u.id } : {};
  }
  const slug = /\/(?:listings|alojamiento)\/([^/?#\s]+)/i.exec(text)?.[1];
  if (slug) {
    const listing = getListingBySlug(decodeURIComponent(slug));
    if (listing) return { userId: listing.hostId, listingId: listing.id };
  }
  return {};
}

export type CreateReportInput = {
  kind?: unknown;
  category?: unknown;
  mode?: unknown;
  targetUserId?: unknown;
  targetLabel?: unknown;
  listingId?: unknown;
  bookingId?: unknown;
  message?: unknown;
  contact?: unknown;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function submitUserReport(
  reporter: UserRecord,
  input: CreateReportInput
): { ok: true; report: UserReportRecord } | { ok: false; error: string; status: number } {
  const kind = REPORT_KINDS.find((k) => k.kind === input.kind);
  if (!kind) return { ok: false, error: "Elige qué quieres enviar.", status: 400 };
  const categories = REPORT_CATEGORIES[kind.kind];
  const category = categories.includes(str(input.category, 80)) ? str(input.category, 80) : "Otro";
  const message = str(input.message, REPORT_MESSAGE_MAX);
  if (message.length < 10) return { ok: false, error: "Cuéntanos un poco más (mínimo 10 caracteres).", status: 400 };
  if (countRecentReportsBy(reporter.id, Date.now() - 86_400_000) >= MAX_PER_DAY) {
    return { ok: false, error: "Ya enviaste muchos reportes hoy. Intenta mañana.", status: 429 };
  }

  let targetUserId: string | undefined;
  let listingId: string | undefined;
  const targetLabel = str(input.targetLabel, 300) || undefined;
  const pickedId = str(input.targetUserId, 80);
  const pickedListing = str(input.listingId, 80);

  if (pickedListing) {
    const listing = getListingById(pickedListing);
    if (listing) {
      listingId = listing.id;
      targetUserId = listing.hostId;
    }
  }
  if (pickedId && listReportCounterparts(reporter.id).some((c) => c.userId === pickedId)) {
    targetUserId = pickedId;
  }
  if (!targetUserId && targetLabel) {
    const found = resolveTargetFromLabel(targetLabel);
    targetUserId = found.userId;
    listingId ??= found.listingId;
  }
  if (targetUserId === reporter.id && kind.kind === "report_account") targetUserId = undefined;
  if (kind.needsTarget && !targetUserId && !targetLabel && kind.kind === "report_account") {
    return { ok: false, error: "Dinos qué cuenta quieres denunciar: elígela, pega la liga del anuncio o escribe su correo.", status: 400 };
  }

  const bookingId = str(input.bookingId, 80) || undefined;
  const ownsBooking =
    bookingId &&
    [...listBookingsForGuest(reporter.id), ...listBookingsForHost(reporter.id)].some((b) => b.id === bookingId);

  const report = createUserReport({
    kind: kind.kind,
    category,
    reporterId: reporter.id,
    reporterEmail: reporter.email,
    reporterName: reporter.fullName,
    reporterMode: input.mode === "host" ? "host" : "guest",
    ...(targetUserId ? { targetUserId } : {}),
    ...(targetLabel ? { targetLabel } : {}),
    ...(listingId ? { listingId } : {}),
    ...(ownsBooking ? { bookingId } : {}),
    message,
    ...(str(input.contact, 160) ? { contact: str(input.contact, 160) } : {}),
  });
  return { ok: true, report };
}

export function myReportViews(userId: string): MyReportView[] {
  return listReportsByReporter(userId).map((r) => {
    const { adminNote: _note, reporterEmail: _email, targetUserId, ...rest } = r;
    void _note;
    void _email;
    const target = targetUserId ? findUserById(targetUserId) : undefined;
    return { ...rest, ...(target ? { targetName: target.fullName } : {}) };
  });
}

const VALID_STATUS: UserReportStatus[] = ["open", "in_review", "resolved", "dismissed"];

/** Cambio desde el panel de admin. Avisa a quien reportó si cambió el estado o hay respuesta nueva. */
export function adminUpdateReport(
  id: string,
  body: { status?: unknown; adminNote?: unknown; adminReply?: unknown; targetEmail?: unknown }
): { ok: true; report: UserReportRecord } | { ok: false; error: string; status: number } {
  const status = VALID_STATUS.find((s) => s === body.status);
  let targetUserId: string | null | undefined;
  if (typeof body.targetEmail === "string") {
    const email = body.targetEmail.trim();
    if (!email) targetUserId = null;
    else {
      const u = findUserByEmail(email);
      if (!u) return { ok: false, error: "No hay ninguna cuenta con ese correo.", status: 404 };
      targetUserId = u.id;
    }
  }
  const reply = typeof body.adminReply === "string" ? body.adminReply.slice(0, 2000) : undefined;
  const before = findUserReport(id);
  const next = updateUserReport(id, {
    ...(status ? { status } : {}),
    ...(typeof body.adminNote === "string" ? { adminNote: body.adminNote.slice(0, 4000) } : {}),
    ...(reply !== undefined ? { adminReply: reply } : {}),
    ...(targetUserId !== undefined ? { targetUserId } : {}),
  });
  if (!next) return { ok: false, error: "No existe ese reporte.", status: 404 };

  const statusChanged = before && status && before.status !== status;
  const newReply = reply !== undefined && reply.trim() && reply.trim() !== (before?.adminReply ?? "");
  if (statusChanged || newReply) {
    notifyUser(next.reporterId, {
      kind: "support",
      title: "Tu reporte: {status}",
      body: newReply ? "El equipo de Cabibee te respondió. Toca para leerlo." : "Actualizamos el estado de lo que nos enviaste.",
      vars: { status: REPORT_STATUS_LABEL[next.status] },
      url: "/reportar",
      tag: `rpt:${next.id}`,
    });
  }
  return { ok: true, report: next };
}
