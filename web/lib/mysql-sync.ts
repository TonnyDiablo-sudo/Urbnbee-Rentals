import "server-only";
import type { BookingRecord } from "@/lib/booking-types";
import { getMysqlPool } from "@/lib/db";
import type { HostInboxMessageRecord } from "@/lib/host-inbox-types";
import type { HostListingRecord, HostProfileRecord, UserRecord } from "@/lib/marketplace-types";
import type { HostEntitlementRecord } from "@/lib/host-entitlement-types";
import type { GuestVerificationRecord } from "@/lib/verification-types";

function dt(iso: string | undefined): Date {
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function warn(scope: string, e: unknown) {
  console.warn(`[mysql-sync] ${scope}:`, e instanceof Error ? e.message : e);
}

export function scheduleMysql(task: () => Promise<void>): void {
  void task().catch((e) => warn("task", e));
}

export async function upsertUserRow(user: UserRecord): Promise<void> {
  const pool = getMysqlPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO urb_users (id, email, password_hash, full_name, phone, address_line, role, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       email = VALUES(email),
       password_hash = VALUES(password_hash),
       full_name = VALUES(full_name),
       phone = VALUES(phone),
       address_line = VALUES(address_line),
       role = VALUES(role)`,
    [
      user.id,
      user.email,
      user.passwordHash,
      user.fullName,
      user.phone ?? null,
      user.addressLine ?? null,
      user.role,
      dt(user.createdAt),
    ]
  );
}

export async function upsertHostProfileRow(profile: HostProfileRecord): Promise<void> {
  const pool = getMysqlPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO urb_host_profiles (user_id, payload, updated_at)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)`,
    [profile.userId, JSON.stringify(profile), new Date()]
  );
}

export async function upsertListingRow(listing: HostListingRecord): Promise<void> {
  const pool = getMysqlPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO urb_listings (id, host_id, slug, published, verified, payload, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       host_id = VALUES(host_id),
       slug = VALUES(slug),
       published = VALUES(published),
       verified = VALUES(verified),
       payload = VALUES(payload),
       updated_at = VALUES(updated_at)`,
    [
      listing.id,
      listing.hostId,
      listing.slug,
      listing.published ? 1 : 0,
      listing.verified ? 1 : 0,
      JSON.stringify(listing),
      dt(listing.createdAt),
      dt(listing.updatedAt),
    ]
  );
}

export async function upsertBookingRow(booking: BookingRecord): Promise<void> {
  const pool = getMysqlPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO urb_bookings (id, listing_id, token, status, payload, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       listing_id = VALUES(listing_id),
       token = VALUES(token),
       status = VALUES(status),
       payload = VALUES(payload),
       updated_at = VALUES(updated_at)`,
    [
      booking.id,
      booking.listingId,
      booking.token,
      booking.status,
      JSON.stringify(booking),
      dt(booking.createdAt),
      dt(booking.updatedAt),
    ]
  );
}

export async function upsertHostEntitlementRow(row: HostEntitlementRecord): Promise<void> {
  const pool = getMysqlPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO urb_host_sku_entitlements
       (host_id, sku, status, source, stripe_subscription_id, current_period_end, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       source = VALUES(source),
       stripe_subscription_id = VALUES(stripe_subscription_id),
       current_period_end = VALUES(current_period_end),
       updated_at = VALUES(updated_at)`,
    [
      row.hostId,
      row.sku,
      row.status,
      row.source,
      row.stripeSubscriptionId ?? null,
      row.currentPeriodEnd ? dt(row.currentPeriodEnd) : null,
      dt(row.updatedAt),
    ]
  );
}

export async function upsertVerificationRow(row: GuestVerificationRecord): Promise<void> {
  const pool = getMysqlPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO urb_guest_verification (user_id, payload, updated_at)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)`,
    [row.userId, JSON.stringify(row), new Date()]
  );
}

export async function upsertInboxRow(message: HostInboxMessageRecord): Promise<void> {
  const pool = getMysqlPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO urb_host_inbox_messages
       (id, listing_id, host_id, guest_session_id, sender, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       payload = VALUES(payload),
       sender = VALUES(sender)`,
    [
      message.id,
      message.listingId,
      message.hostId,
      message.guestSessionId,
      message.sender,
      JSON.stringify(message),
      dt(message.createdAt),
    ]
  );
}

export async function replaceBeeagentLinks(
  links: { hostId: string; beeagentCustomerId: number; email: string; linkedAt: string }[],
  pending: { code: string; hostId: string; expiresAt: string }[]
): Promise<void> {
  const pool = getMysqlPool();
  if (!pool) return;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM urb_beeagent_pending_codes");
    await conn.query("DELETE FROM urb_beeagent_host_links");
    for (const l of links) {
      await conn.query(
        `INSERT INTO urb_beeagent_host_links (host_id, beeagent_customer_id, email, linked_at)
         VALUES (?, ?, ?, ?)`,
        [l.hostId, l.beeagentCustomerId, l.email, dt(l.linkedAt)]
      );
    }
    for (const p of pending) {
      await conn.query(
        `INSERT INTO urb_beeagent_pending_codes (code, host_id, expires_at) VALUES (?, ?, ?)`,
        [p.code, p.hostId, dt(p.expiresAt)]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function upsertJsonBlob(docKey: string, payload: unknown): Promise<void> {
  const pool = getMysqlPool();
  if (!pool) return;
  await pool.query(
    `INSERT INTO urb_json_blobs (doc_key, payload, updated_at)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)`,
    [docKey, JSON.stringify(payload), new Date()]
  );
}
