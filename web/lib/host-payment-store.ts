import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { getMysqlPool } from "@/lib/db";
import {
  decryptHostPaymentPayload,
  encryptHostPaymentPayload,
  hostPaymentCryptoReady,
  secretLast4,
} from "@/lib/host-payment-crypto";
import type {
  HostPaymentPublicView,
  HostPaymentRecord,
  HostPaymentSecrets,
} from "@/lib/host-payment-types";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "host-payment-creds.json");
const rows = new Map<string, HostPaymentRecord>();
let cachedMtime = 0;

function nowIso() {
  return new Date().toISOString();
}

function persist() {
  try {
    ensureDir(getDataDir());
    writeFileSync(
      DATA_FILE,
      JSON.stringify({ version: 1, creds: [...rows.values()] }, null, 2),
      "utf8"
    );
    if (existsSync(DATA_FILE)) cachedMtime = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[host-payment] persist failed:", e);
  }
  const pool = getMysqlPool();
  if (!pool) return;
  void (async () => {
    for (const r of rows.values()) {
      await pool.query(
        `INSERT INTO urb_host_payment_creds
           (host_id, ciphertext, secret_last4, last_verified_at, last_error, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           ciphertext = VALUES(ciphertext),
           secret_last4 = VALUES(secret_last4),
           last_verified_at = VALUES(last_verified_at),
           last_error = VALUES(last_error),
           updated_at = VALUES(updated_at)`,
        [
          r.hostId,
          r.ciphertext,
          r.secretLast4,
          r.lastVerifiedAt ? new Date(r.lastVerifiedAt) : null,
          r.lastError ?? null,
          new Date(r.updatedAt),
        ]
      );
    }
  })().catch((e) => console.warn("[host-payment] mysql:", e instanceof Error ? e.message : e));
}

function reload() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { creds?: HostPaymentRecord[] };
    rows.clear();
    for (const r of data.creds ?? []) {
      if (r?.hostId && r.ciphertext) rows.set(r.hostId, r);
    }
    cachedMtime = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[host-payment] load failed:", e);
  }
}

function sync() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtime) return;
    reload();
  } catch {
    /* ignore */
  }
}

reload();

export function hostPaymentsWebhookPath(hostId: string): string {
  return `/api/webhooks/stripe/host/${encodeURIComponent(hostId)}`;
}

export function getHostPaymentPublic(hostId: string): HostPaymentPublicView {
  sync();
  const r = rows.get(hostId);
  return {
    connected: Boolean(r),
    secretLast4: r?.secretLast4 ?? null,
    lastVerifiedAt: r?.lastVerifiedAt ?? null,
    lastError: r?.lastError ?? null,
    webhookPath: hostPaymentsWebhookPath(hostId),
    webhookAuto: Boolean(r && getHostPaymentSecrets(hostId)?.webhookEndpointId),
    cryptoReady: hostPaymentCryptoReady(),
  };
}

export function getHostPaymentSecrets(hostId: string): HostPaymentSecrets | undefined {
  sync();
  const r = rows.get(hostId);
  if (!r) return undefined;
  try {
    const parsed = JSON.parse(decryptHostPaymentPayload(r.ciphertext)) as HostPaymentSecrets;
    if (!parsed.stripeSecretKey?.trim()) return undefined;
    return {
      stripeSecretKey: parsed.stripeSecretKey.trim(),
      webhookSecret: parsed.webhookSecret?.trim() ?? "",
      webhookEndpointId: parsed.webhookEndpointId || undefined,
    };
  } catch (e) {
    console.warn("[host-payment] decrypt", hostId, e instanceof Error ? e.message : e);
    return undefined;
  }
}

export function saveHostPaymentSecrets(
  hostId: string,
  secrets: HostPaymentSecrets,
  opts: { lastVerifiedAt?: string; lastError?: string }
): HostPaymentPublicView {
  const ciphertext = encryptHostPaymentPayload(
    JSON.stringify({
      stripeSecretKey: secrets.stripeSecretKey.trim(),
      webhookSecret: secrets.webhookSecret.trim(),
      ...(secrets.webhookEndpointId ? { webhookEndpointId: secrets.webhookEndpointId } : {}),
    })
  );
  rows.set(hostId, {
    hostId,
    ciphertext,
    secretLast4: secretLast4(secrets.stripeSecretKey),
    lastVerifiedAt: opts.lastVerifiedAt,
    lastError: opts.lastError,
    updatedAt: nowIso(),
  });
  persist();
  return getHostPaymentPublic(hostId);
}

export function deleteHostPaymentSecrets(hostId: string): void {
  sync();
  rows.delete(hostId);
  persist();
  const pool = getMysqlPool();
  if (pool) {
    void pool
      .query("DELETE FROM urb_host_payment_creds WHERE host_id = ?", [hostId])
      .catch((e) => console.warn("[host-payment] mysql delete:", e instanceof Error ? e.message : e));
  }
}

export function hostHasStripeConnected(hostId: string): boolean {
  sync();
  return rows.has(hostId);
}
