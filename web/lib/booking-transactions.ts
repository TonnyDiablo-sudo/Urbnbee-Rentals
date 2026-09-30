import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { getMysqlPool } from "@/lib/db";
import type { BookingTransactionRecord } from "@/lib/host-payment-types";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "booking-transactions.json");
const rows: BookingTransactionRecord[] = [];
let cachedMtime = 0;

function persist() {
  try {
    ensureDir(getDataDir());
    writeFileSync(DATA_FILE, JSON.stringify({ version: 1, transactions: rows }, null, 2), "utf8");
    if (existsSync(DATA_FILE)) cachedMtime = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[booking-tx] persist failed:", e);
  }
}

function reload() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as {
      transactions?: BookingTransactionRecord[];
    };
    rows.length = 0;
    for (const t of data.transactions ?? []) {
      if (t?.id && t.bookingId) rows.push(t);
    }
    cachedMtime = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[booking-tx] load failed:", e);
  }
}

function sync() {
  try {
    if (!existsSync(DATA_FILE)) return;
    if (statSync(DATA_FILE).mtimeMs !== cachedMtime) reload();
  } catch {
    /* ignore */
  }
}

reload();

export function recordBookingTransaction(
  input: Omit<BookingTransactionRecord, "id" | "createdAt">
): BookingTransactionRecord {
  sync();
  const row: BookingTransactionRecord = {
    ...input,
    id: `txn_${randomBytes(8).toString("hex")}`,
    createdAt: new Date().toISOString(),
  };
  rows.push(row);
  persist();
  const pool = getMysqlPool();
  if (pool) {
    void pool
      .query(
        `INSERT INTO urb_booking_transactions
           (id, booking_id, host_id, charged_via, provider_ref, amount_cents, currency,
            processor_fee_cents, net_cents, status, payload, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.bookingId,
          row.hostId,
          row.chargedVia,
          row.providerRef,
          row.amountCents,
          row.currency,
          row.processorFeeCents ?? null,
          row.netCents ?? null,
          row.status,
          JSON.stringify(row),
          new Date(row.createdAt),
        ]
      )
      .catch((e) => console.warn("[booking-tx] mysql:", e instanceof Error ? e.message : e));
  }
  return row;
}
