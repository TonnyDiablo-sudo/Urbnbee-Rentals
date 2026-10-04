/**
 * C1: copia idempotente JSON (URBNBEE_DATA_DIR o ./data) → MySQL.
 * No imprime PII; solo conteos.
 */
import { existsSync, readFileSync } from "fs";
import { dirname, isAbsolute, join, resolve } from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseConnectionString(urlString) {
  const u = new URL(urlString);
  if (u.protocol !== "mysql:" && u.protocol !== "mysql2:") return null;
  const database = u.pathname.replace(/^\//, "").split("?")[0];
  if (!database) return null;
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username || ""),
    password: decodeURIComponent(u.password || ""),
    database,
  };
}

function getConfig() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.MYSQL_URL,
    process.env.DATABASE_PRIVATE_URL,
  ].filter(Boolean);
  for (const c of candidates) {
    const p = parseConnectionString(c);
    if (p) return p;
  }
  if (
    process.env.DB_HOST &&
    process.env.DB_USER &&
    process.env.DB_PASSWORD !== undefined &&
    process.env.DB_NAME
  ) {
    return {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    };
  }
  throw new Error("Falta conexión MySQL");
}

function dataDir() {
  const raw = process.env.URBNBEE_DATA_DIR?.trim();
  if (raw) return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
  return join(__dirname, "..", "data");
}

function readJson(name) {
  const p = join(dataDir(), name);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    console.warn("json-to-mysql: no pude leer", name, e?.message);
    return null;
  }
}

function dt(iso) {
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function eachNight(checkIn, checkOut) {
  const out = [];
  const [y1, m1, d1] = String(checkIn).split("-").map(Number);
  const [y2, m2, d2] = String(checkOut).split("-").map(Number);
  const cur = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  while (cur < end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

const HOLD = new Set(["AWAITING_PAYMENT", "PENDING", "PENDING_HOST", "AWAITING_DETAILS", "CONFIRMED"]);

const conn = await mysql.createConnection(getConfig());
const counts = {
  users: 0,
  profiles: 0,
  listings: 0,
  bookings: 0,
  nights: 0,
  nightConflicts: 0,
  verification: 0,
  inbox: 0,
  beeagent: 0,
  blobs: 0,
  entitlements: 0,
};

try {
  const market = readJson("marketplace-store.json");
  const users = Array.isArray(market?.users) ? market.users : [];
  const profiles = market?.hostProfiles && typeof market.hostProfiles === "object" ? market.hostProfiles : {};
  const listings = Array.isArray(market?.listings) ? market.listings : [];

  for (const u of users) {
    if (!u?.id || !u.email) continue;
    await conn.query(
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
        u.id,
        u.email,
        u.passwordHash ?? "",
        u.fullName ?? "",
        u.phone ?? null,
        u.addressLine ?? null,
        u.role === "admin" || u.role === "host" ? u.role : "guest",
        dt(u.createdAt),
      ]
    );
    counts.users++;
  }

  for (const [uid, p] of Object.entries(profiles)) {
    const profile = { ...(p ?? {}), userId: uid };
    await conn.query(
      `INSERT INTO urb_host_profiles (user_id, payload, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)`,
      [uid, JSON.stringify(profile), new Date()]
    );
    counts.profiles++;
  }

  for (const l of listings) {
    if (!l?.id || !l.hostId || !l.slug) continue;
    await conn.query(
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
        l.id,
        l.hostId,
        l.slug,
        l.published ? 1 : 0,
        l.verified ? 1 : 0,
        JSON.stringify(l),
        dt(l.createdAt),
        dt(l.updatedAt),
      ]
    );
    counts.listings++;
  }

  const knownListings = new Set(listings.map((l) => l.id).filter(Boolean));
  const knownUsers = new Set(users.map((u) => u.id).filter(Boolean));

  async function ensureUserStub(userId) {
    if (!userId || knownUsers.has(userId)) return;
    await conn.query(
      `INSERT INTO urb_users (id, email, password_hash, full_name, phone, address_line, role, created_at)
       VALUES (?, ?, '', 'Huésped', NULL, NULL, 'guest', ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [userId, `stub+${userId}@cabibee.invalid`, new Date()]
    );
    knownUsers.add(userId);
    counts.users++;
  }

  async function ensureListingStub(listingId, hostId) {
    if (!listingId || knownListings.has(listingId)) return;
    await ensureUserStub(hostId || "usr_orphan");
    const hid = hostId && knownUsers.has(hostId) ? hostId : [...knownUsers][0];
    if (!hid) return;
    const slug = `orphan-${String(listingId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)}`;
    await conn.query(
      `INSERT INTO urb_listings (id, host_id, slug, published, verified, payload, created_at, updated_at)
       VALUES (?, ?, ?, 0, 0, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [
        listingId,
        hid,
        slug,
        JSON.stringify({ id: listingId, hostId: hid, slug, title: "Listing huérfano (migración C1)" }),
        new Date(),
        new Date(),
      ]
    );
    knownListings.add(listingId);
    counts.listings++;
  }

  const bookDoc = readJson("bookings.json");
  const bookings = Array.isArray(bookDoc?.bookings) ? bookDoc.bookings : [];
  for (const b of bookings) {
    if (!b?.id || !b.listingId || !b.token) continue;
    await ensureListingStub(b.listingId, b.hostId);
    if (b.guestUserId) await ensureUserStub(b.guestUserId);
  }
  for (const b of bookings) {
    if (!b?.id || !b.listingId || !b.token) continue;
    await conn.query(
      `INSERT INTO urb_bookings (id, listing_id, token, status, payload, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         listing_id = VALUES(listing_id),
         token = VALUES(token),
         status = VALUES(status),
         payload = VALUES(payload),
         updated_at = VALUES(updated_at)`,
      [
        b.id,
        b.listingId,
        b.token,
        b.status ?? "AWAITING_PAYMENT",
        JSON.stringify(b),
        dt(b.createdAt),
        dt(b.updatedAt),
      ]
    );
    counts.bookings++;
  }

  await conn.query("DELETE FROM urb_booking_nights");
  for (const b of bookings) {
    if (!HOLD.has(b.status)) continue;
    const listingId = b.hostAdjustedListingId ?? b.listingId;
    const checkIn = b.hostAdjustedCheckIn ?? b.checkIn;
    const checkOut = b.hostAdjustedCheckOut ?? b.checkOut;
    if (!listingId || !checkIn || !checkOut) continue;
    for (const night of eachNight(checkIn, checkOut)) {
      try {
        await conn.query(
          `INSERT INTO urb_booking_nights (listing_id, night_date, booking_id) VALUES (?, ?, ?)`,
          [listingId, night, b.id]
        );
        counts.nights++;
      } catch (e) {
        if (e?.errno === 1062) counts.nightConflicts++;
        else throw e;
      }
    }
  }

  const verDoc = readJson("guest-verification.json");
  for (const r of verDoc?.verifications ?? []) {
    if (!r?.userId) continue;
    await conn.query(
      `INSERT INTO urb_guest_verification (user_id, payload, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)`,
      [r.userId, JSON.stringify(r), new Date()]
    );
    counts.verification++;
  }

  const entitlementRows = [];
  const seenEnt = new Set();
  const pushEnt = (row) => {
    if (!row?.hostId || !row?.sku) return;
    const k = `${row.hostId}::${row.sku}`;
    if (seenEnt.has(k)) return;
    seenEnt.add(k);
    entitlementRows.push(row);
  };
  const entDoc = readJson("host-entitlements.json");
  for (const r of entDoc?.entitlements ?? []) pushEnt(r);
  for (const r of verDoc?.verifications ?? []) {
    const s = r?.hostSubscriptionStatus;
    const status =
      s === "active" || s === "trialing" ? "active" : s === "past_due" ? "past_due" : null;
    if (!status || !r.userId) continue;
    pushEnt({
      hostId: r.userId,
      sku: "cabibee_booking_engine",
      status,
      source: "cabibee_direct",
      stripeSubscriptionId: r.hostStripeSubscriptionId,
      currentPeriodEnd: r.hostCurrentPeriodEnd,
      updatedAt: r.hostCurrentPeriodEnd ?? r.updatedAt,
    });
    pushEnt({
      hostId: r.userId,
      sku: "cabibee_host_verification",
      status,
      source: "derived",
      stripeSubscriptionId: r.hostStripeSubscriptionId,
      currentPeriodEnd: r.hostCurrentPeriodEnd,
      updatedAt: r.hostCurrentPeriodEnd ?? r.updatedAt,
    });
  }
  for (const r of entitlementRows) {
    await conn.query(
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
        r.hostId,
        r.sku,
        r.status,
        r.source ?? "cabibee_direct",
        r.stripeSubscriptionId ?? null,
        r.currentPeriodEnd ? dt(r.currentPeriodEnd) : null,
        dt(r.updatedAt),
      ]
    );
    counts.entitlements++;
  }

  const inboxDoc = readJson("host-inbox-messages.json");
  for (const m of inboxDoc?.messages ?? []) {
    if (!m?.id) continue;
    await conn.query(
      `INSERT INTO urb_host_inbox_messages
         (id, listing_id, host_id, guest_session_id, sender, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), sender = VALUES(sender)`,
      [
        m.id,
        m.listingId ?? "",
        m.hostId ?? "",
        m.guestSessionId ?? "",
        m.sender ?? "guest",
        JSON.stringify(m),
        dt(m.createdAt),
      ]
    );
    counts.inbox++;
  }

  const bee = readJson("beeagent-host-links.json");
  if (bee) {
    await conn.query("DELETE FROM urb_beeagent_pending_codes");
    await conn.query("DELETE FROM urb_beeagent_host_links");
    for (const l of bee.links ?? []) {
      if (!l?.hostId || !Number.isFinite(l.beeagentCustomerId)) continue;
      await conn.query(
        `INSERT INTO urb_beeagent_host_links (host_id, beeagent_customer_id, email, linked_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           beeagent_customer_id = VALUES(beeagent_customer_id),
           email = VALUES(email),
           linked_at = VALUES(linked_at)`,
        [l.hostId, l.beeagentCustomerId, l.email ?? "", dt(l.linkedAt)]
      );
      counts.beeagent++;
    }
    for (const p of bee.pendingCodes ?? []) {
      if (!p?.code) continue;
      await conn.query(
        `INSERT INTO urb_beeagent_pending_codes (code, host_id, expires_at) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE host_id = VALUES(host_id), expires_at = VALUES(expires_at)`,
        [p.code, p.hostId ?? "", dt(p.expiresAt)]
      );
    }
  }

  const blobs = [
    ["membership-plans", "membership-plans.json"],
    ["screening-cases", "screening-cases.json"],
    ["screening-price", "screening-price.json"],
    ["stay-reviews", "stay-reviews.json"],
    ["blog-published-posts", "blog-published-posts.json"],
    ["blog-bot-config", "blog-bot-config.json"],
    ["push-subscriptions", "push-subscriptions.json"],
    ["beeagent-booking-links", "beeagent-booking-links.json"],
    ["beeagent-agent-status", "beeagent-agent-status.json"],
    ["beeagent-permissions", "beeagent-permissions.json"],
    ["outbound-webhooks", "outbound-webhooks.json"],
  ];
  for (const [key, file] of blobs) {
    const doc = readJson(file);
    if (!doc) continue;
    await conn.query(
      `INSERT INTO urb_json_blobs (doc_key, payload, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)`,
      [key, JSON.stringify(doc), new Date()]
    );
    counts.blobs++;
  }

  console.log("json-to-mysql: OK", JSON.stringify(counts));
} finally {
  await conn.end();
}
