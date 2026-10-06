import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import type { BookingRecord, BookingStatus } from "@/lib/booking-types";
import { dateRangesOverlap } from "@/lib/booking-helpers";
import { mysqlInsertBookingWithNights } from "@/lib/booking-nights";
import { getListingById } from "@/lib/marketplace-store";
import { scheduleMysql, upsertBookingRow } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "bookings.json");
const rows: BookingRecord[] = [];
let cachedMtimeMs = 0;

const ACTIVE_BLOCKING: BookingStatus[] = [
  "AWAITING_PAYMENT",
  "PENDING",
  "PENDING_HOST",
  "AWAITING_DETAILS",
  "CONFIRMED",
];

function persist() {
  try {
    ensureDir(getDataDir());
    writeFileSync(DATA_FILE, JSON.stringify({ version: 1, bookings: rows }, null, 2), "utf8");
    if (existsSync(DATA_FILE)) cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(async () => {
      for (const b of rows) await upsertBookingRow(b);
    });
  } catch (e) {
    console.warn("[bookings-store] persist failed:", e);
  }
}

function reloadFromDisk() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const raw = readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw) as { bookings?: BookingRecord[] };
    rows.length = 0;
    for (const b of data.bookings ?? []) {
      if (b?.id && b.listingId && b.token && b.status) rows.push(b);
    }
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[bookings-store] load failed:", e);
  }
}

function syncIfStale() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    reloadFromDisk();
  } catch {
    /* ignore */
  }
}

reloadFromDisk();

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${randomBytes(10).toString("hex")}`;
}

function randomSixDigitToken(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function tokenExists(token: string): boolean {
  return rows.some((r) => r.token === token);
}

function uniqueToken(): string {
  for (let i = 0; i < 50; i++) {
    const t = randomSixDigitToken();
    if (!tokenExists(t)) return t;
  }
  return randomSixDigitToken() + randomBytes(2).toString("hex").slice(0, 2); // fallback rare
}

export function findBookingByToken(token: string): BookingRecord | undefined {
  syncIfStale();
  const t = token.replace(/\D/g, "").slice(0, 6);
  return rows.find((r) => r.token === t);
}

export function getBookingById(bookingId: string): BookingRecord | undefined {
  syncIfStale();
  return rows.find((r) => r.id === bookingId);
}

export function findBookingByBeeagentRef(ref: string): BookingRecord | undefined {
  syncIfStale();
  const key = ref.trim();
  if (!key) return undefined;
  return rows.find((r) => r.beeagentRef === key);
}

export function findBookingByCheckoutSessionId(sessionId: string): BookingRecord | undefined {
  syncIfStale();
  const key = sessionId.trim();
  if (!key.startsWith("cs_")) return undefined;
  return rows.find(
    (r) => r.stripeCheckoutSessionId === key || r.adjustments?.some((a) => a.stripeCheckoutSessionId === key)
  );
}

export function listBookingsForHost(hostId: string): BookingRecord[] {
  syncIfStale();
  return [...rows]
    .filter((r) => r.hostId === hostId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function listBookingsForGuest(guestUserId: string): BookingRecord[] {
  syncIfStale();
  return [...rows]
    .filter((r) => r.guestUserId === guestUserId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** Estancias donde el usuario va como acompañante (lo agregó quien reservó). */
export function listBookingsAsCompanion(userId: string): BookingRecord[] {
  syncIfStale();
  return rows.filter((r) => r.guestUserId !== userId && r.party?.some((p) => p.userId === userId));
}

/** Solapa reservas activas en el mismo listing (excluye optional bookingId al editar). */
export function hasOverlappingActiveBooking(
  listingId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string
): boolean {
  syncIfStale();
  for (const r of rows) {
    if (r.listingId !== listingId) continue;
    if (!ACTIVE_BLOCKING.includes(r.status)) continue;
    if (excludeBookingId && r.id === excludeBookingId) continue;
    const cin = r.hostAdjustedCheckIn ?? r.checkIn;
    const cout = r.hostAdjustedCheckOut ?? r.checkOut;
    if (dateRangesOverlap(checkIn, checkOut, cin, cout)) return true;
  }
  return false;
}

/** Actualización interna (pago, webhooks) — no valida anfitrión. */
export function patchBookingRecord(
  bookingId: string,
  patch: Partial<BookingRecord>
): BookingRecord | undefined {
  syncIfStale();
  const idx = rows.findIndex((r) => r.id === bookingId);
  if (idx === -1) return undefined;
  const prev = rows[idx];
  const next: BookingRecord = {
    ...prev,
    ...patch,
    id: prev.id,
    hostId: prev.hostId,
    token: prev.token,
    updatedAt: nowIso(),
  };
  rows[idx] = next;
  persist();
  return next;
}

export function insertBooking(
  record: Omit<BookingRecord, "id" | "createdAt" | "updatedAt" | "token"> & { token?: string }
): BookingRecord {
  syncIfStale();
  const token = record.token && !tokenExists(record.token) ? record.token : uniqueToken();
  const b: BookingRecord = {
    ...record,
    token,
    id: id("bkg"),
    paymentStatus: record.paymentStatus ?? "unpaid",
    contractStatus: record.contractStatus ?? "pending",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  rows.push(b);
  persist();
  return b;
}

/** Crea la reserva; con MySQL ocupa las noches en la misma transacción. */
export async function insertBookingLocked(
  record: Omit<BookingRecord, "id" | "createdAt" | "updatedAt" | "token"> & { token?: string }
): Promise<{ ok: true; booking: BookingRecord } | { ok: false; reason: "overlap" | "error" }> {
  syncIfStale();
  const token = record.token && !tokenExists(record.token) ? record.token : uniqueToken();
  const booking: BookingRecord = {
    ...record,
    token,
    id: id("bkg"),
    paymentStatus: record.paymentStatus ?? "unpaid",
    contractStatus: record.contractStatus ?? "pending",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const locked = await mysqlInsertBookingWithNights(booking);
  if (locked === "overlap") return { ok: false, reason: "overlap" };
  if (locked === "error") return { ok: false, reason: "error" };
  rows.push(booking);
  persist();
  return { ok: true, booking };
}

/** Huésped con token 6 dígitos — solo campos de contacto en AWAITING_DETAILS. */
export function patchBookingByGuestToken(
  token: string,
  patch: Pick<BookingRecord, "guestPhone" | "guestFinishNotes">
): BookingRecord | undefined {
  syncIfStale();
  const t = token.replace(/\D/g, "").slice(0, 6);
  const idx = rows.findIndex((r) => r.token === t);
  if (idx === -1) return undefined;
  const prev = rows[idx];
  if (prev.status !== "AWAITING_DETAILS") return undefined;
  const next: BookingRecord = {
    ...prev,
    ...patch,
    id: prev.id,
    hostId: prev.hostId,
    token: prev.token,
    updatedAt: nowIso(),
  };
  rows[idx] = next;
  persist();
  return next;
}

export function updateBooking(
  bookingId: string,
  hostId: string,
  patch: Partial<
    Pick<
      BookingRecord,
      | "status"
      | "hostAdjustedCheckIn"
      | "hostAdjustedCheckOut"
      | "hostAdjustedListingId"
      | "guestPhone"
      | "guestFinishNotes"
      | "listingId"
      | "checkIn"
      | "checkOut"
      | "nights"
      | "estimatedTotalMxn"
    >
  >
): BookingRecord | undefined {
  syncIfStale();
  const idx = rows.findIndex((r) => r.id === bookingId);
  if (idx === -1) return undefined;
  const prev = rows[idx];
  if (prev.hostId !== hostId) return undefined;
  const next: BookingRecord = {
    ...prev,
    ...patch,
    id: prev.id,
    hostId: prev.hostId,
    token: prev.token,
    updatedAt: nowIso(),
  };
  rows[idx] = next;
  persist();
  return next;
}

/** Validación al aceptar: solapa con otras reservas usando fechas efectivas finales. */
export function canAcceptBooking(bookingId: string): { ok: boolean; reason?: string } {
  const b = getBookingById(bookingId);
  if (!b) return { ok: false, reason: "no existe" };
  const listingId = b.hostAdjustedListingId ?? b.listingId;
  const cin = b.hostAdjustedCheckIn ?? b.checkIn;
  const cout = b.hostAdjustedCheckOut ?? b.checkOut;
  const listing = getListingById(listingId);
  if (!listing) return { ok: false, reason: "listing" };
  if (hasOverlappingActiveBooking(listingId, cin, cout, bookingId)) {
    return { ok: false, reason: "overlap" };
  }
  return { ok: true };
}

/** Admin-only: all bookings sorted by updatedAt desc. */
export function listAllBookings(): BookingRecord[] {
  syncIfStale();
  return [...rows].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
