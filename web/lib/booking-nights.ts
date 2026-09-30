import "server-only";
import type { PoolConnection } from "mysql2/promise";
import type { BookingRecord, BookingStatus } from "@/lib/booking-types";
import { parseLocalDate, toLocalISODate } from "@/lib/booking-helpers";
import { getMysqlPool } from "@/lib/db";
import { findUserById, getListingById } from "@/lib/marketplace-store";
import { upsertBookingRow, upsertListingRow, upsertUserRow } from "@/lib/mysql-sync";

export const NIGHT_HOLD_STATUSES: BookingStatus[] = [
  "AWAITING_PAYMENT",
  "PENDING",
  "PENDING_HOST",
  "AWAITING_DETAILS",
  "CONFIRMED",
];

export function eachNightDates(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  const cur = parseLocalDate(checkIn);
  const end = parseLocalDate(checkOut);
  while (cur < end) {
    out.push(toLocalISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function bookingOccupancy(booking: BookingRecord): {
  listingId: string;
  checkIn: string;
  checkOut: string;
} {
  return {
    listingId: booking.hostAdjustedListingId ?? booking.listingId,
    checkIn: booking.hostAdjustedCheckIn ?? booking.checkIn,
    checkOut: booking.hostAdjustedCheckOut ?? booking.checkOut,
  };
}

function isDup(e: unknown): boolean {
  return Boolean(e && typeof e === "object" && "errno" in e && (e as { errno: number }).errno === 1062);
}

async function ensureListingLocked(conn: PoolConnection, listingId: string): Promise<boolean> {
  const listing = getListingById(listingId);
  if (!listing) return false;
  const host = findUserById(listing.hostId);
  if (host) await upsertUserRow(host);
  await upsertListingRow(listing);
  const [rows] = await conn.query("SELECT id FROM urb_listings WHERE id = ? FOR UPDATE", [listingId]);
  return Array.isArray(rows) && rows.length > 0;
}

async function insertNights(
  conn: PoolConnection,
  listingId: string,
  bookingId: string,
  checkIn: string,
  checkOut: string
): Promise<void> {
  for (const night of eachNightDates(checkIn, checkOut)) {
    await conn.query(
      `INSERT INTO urb_booking_nights (listing_id, night_date, booking_id) VALUES (?, ?, ?)`,
      [listingId, night, bookingId]
    );
  }
}

export type NightLockResult = "ok" | "overlap" | "no_db" | "error";

/** Inserta la reserva y ocupa noches en la misma transacción. */
export async function mysqlInsertBookingWithNights(booking: BookingRecord): Promise<NightLockResult> {
  const pool = getMysqlPool();
  if (!pool) return "no_db";
  const guest = booking.guestUserId ? findUserById(booking.guestUserId) : undefined;
  if (guest) {
    try {
      await upsertUserRow(guest);
    } catch (e) {
      console.warn("[booking-nights] guest upsert:", e instanceof Error ? e.message : e);
    }
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const occ = bookingOccupancy(booking);
    const locked = await ensureListingLocked(conn, occ.listingId);
    if (!locked) {
      await conn.rollback();
      return "error";
    }
    await conn.query(
      `INSERT INTO urb_bookings (id, listing_id, token, status, payload, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        booking.id,
        booking.listingId,
        booking.token,
        booking.status,
        JSON.stringify(booking),
        new Date(booking.createdAt),
        new Date(booking.updatedAt),
      ]
    );
    if (NIGHT_HOLD_STATUSES.includes(booking.status)) {
      await insertNights(conn, occ.listingId, booking.id, occ.checkIn, occ.checkOut);
    }
    await conn.commit();
    return "ok";
  } catch (e) {
    await conn.rollback();
    if (isDup(e)) return "overlap";
    console.warn("[booking-nights] insert:", e instanceof Error ? e.message : e);
    return "error";
  } finally {
    conn.release();
  }
}

/** Reemplaza noches (aceptar / cambiar fechas) o las suelta si el estado ya no las retiene. */
export async function mysqlApplyBookingOccupancy(booking: BookingRecord): Promise<NightLockResult> {
  const pool = getMysqlPool();
  if (!pool) return "no_db";
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const occ = bookingOccupancy(booking);
    if (NIGHT_HOLD_STATUSES.includes(booking.status)) {
      const locked = await ensureListingLocked(conn, occ.listingId);
      if (!locked) {
        await conn.rollback();
        return "error";
      }
    }
    await conn.query("DELETE FROM urb_booking_nights WHERE booking_id = ?", [booking.id]);
    if (NIGHT_HOLD_STATUSES.includes(booking.status)) {
      await insertNights(conn, occ.listingId, booking.id, occ.checkIn, occ.checkOut);
    }
    await conn.commit();
    await upsertBookingRow(booking);
    return "ok";
  } catch (e) {
    await conn.rollback();
    if (isDup(e)) return "overlap";
    console.warn("[booking-nights] apply:", e instanceof Error ? e.message : e);
    return "error";
  } finally {
    conn.release();
  }
}
