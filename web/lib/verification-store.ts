import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import type {
  GuestVerificationRecord,
  VerificationRegion,
  VerificationSubscriptionStatus,
} from "@/lib/verification-types";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "guest-verification.json");
const rows = new Map<string, GuestVerificationRecord>();
let cachedMtimeMs = 0;

function persist() {
  try {
    ensureDir(getDataDir());
    const snapshot = {
      version: 1 as const,
      verifications: [...rows.values()],
    };
    writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    if (existsSync(DATA_FILE)) cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[verification-store] persist failed:", e);
  }
}

function reloadFromDisk() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const raw = readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw) as { verifications?: GuestVerificationRecord[] };
    rows.clear();
    for (const r of data.verifications ?? []) {
      if (r?.userId) rows.set(r.userId, r);
    }
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[verification-store] load failed:", e);
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

function hasRegionalStripePrices(): boolean {
  return Boolean(
    process.env.STRIPE_PRICE_VERIFICATION_MX_MONTHLY?.trim() ||
      process.env.STRIPE_PRICE_VERIFICATION_MX_ANNUAL?.trim() ||
      process.env.STRIPE_PRICE_VERIFICATION_US_MONTHLY?.trim() ||
      process.env.STRIPE_PRICE_VERIFICATION_US_ANNUAL?.trim()
  );
}

/** Al menos un price ID (mensual o anual) en env → se exige membresía para reservar. */
export function verificationSubscriptionConfigured(): boolean {
  return (
    hasRegionalStripePrices() ||
    Boolean(
      process.env.STRIPE_PRICE_VERIFICATION_MONTHLY?.trim() ||
        process.env.STRIPE_PRICE_VERIFICATION_ANNUAL?.trim()
    )
  );
}

export function verificationRegionalPricingEnabled(): boolean {
  return hasRegionalStripePrices();
}

export function verificationPlansAvailableForRegion(region: VerificationRegion): {
  monthly: boolean;
  annual: boolean;
} {
  return {
    monthly: Boolean(resolveVerificationPriceId("monthly", region)),
    annual: Boolean(resolveVerificationPriceId("annual", region)),
  };
}

/** `STRIPE_IDENTITY_ENABLED=true` → además de suscripción activa hace falta KYC verificado (Stripe Identity). */
export function stripeIdentityEnabled(): boolean {
  const v = process.env.STRIPE_IDENTITY_ENABLED?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export type VerificationBillingPlan = "monthly" | "annual";

export function resolveVerificationPriceId(
  plan: VerificationBillingPlan,
  region: VerificationRegion
): string | undefined {
  if (hasRegionalStripePrices()) {
    if (region === "us") {
      const m = process.env.STRIPE_PRICE_VERIFICATION_US_MONTHLY?.trim();
      const a = process.env.STRIPE_PRICE_VERIFICATION_US_ANNUAL?.trim();
      return plan === "annual" ? a || undefined : m || undefined;
    }
    const m = process.env.STRIPE_PRICE_VERIFICATION_MX_MONTHLY?.trim();
    const a = process.env.STRIPE_PRICE_VERIFICATION_MX_ANNUAL?.trim();
    return plan === "annual" ? a || undefined : m || undefined;
  }
  const monthly = process.env.STRIPE_PRICE_VERIFICATION_MONTHLY?.trim();
  const annual = process.env.STRIPE_PRICE_VERIFICATION_ANNUAL?.trim();
  if (plan === "annual") return annual || undefined;
  return monthly || undefined;
}

export function getVerification(userId: string): GuestVerificationRecord | undefined {
  syncIfStale();
  return rows.get(userId);
}

export function upsertVerification(
  userId: string,
  patch: Partial<Omit<GuestVerificationRecord, "userId" | "updatedAt">>
): GuestVerificationRecord {
  syncIfStale();
  const prev = rows.get(userId);
  const next: GuestVerificationRecord = {
    userId,
    subscriptionStatus: patch.subscriptionStatus ?? prev?.subscriptionStatus ?? "none",
    stripeCustomerId: patch.stripeCustomerId ?? prev?.stripeCustomerId,
    stripeSubscriptionId: patch.stripeSubscriptionId ?? prev?.stripeSubscriptionId,
    currentPeriodEnd: patch.currentPeriodEnd ?? prev?.currentPeriodEnd,
    kycStatus: patch.kycStatus ?? prev?.kycStatus ?? "not_started",
    kycProviderSessionId: patch.kycProviderSessionId ?? prev?.kycProviderSessionId,
    kycExpiresAt: patch.kycExpiresAt ?? prev?.kycExpiresAt,
    updatedAt: nowIso(),
  };
  rows.set(userId, next);
  persist();
  return next;
}

export function setVerificationSubscriptionFields(
  userId: string,
  fields: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus: VerificationSubscriptionStatus;
    currentPeriodEnd?: string;
  }
): GuestVerificationRecord {
  return upsertVerification(userId, fields);
}

/** Puede reservar: suscripción activa/trialing y, si Identity está activado, KYC `verified`. */
export function isGuestEligibleToBook(userId: string): boolean {
  if (!verificationSubscriptionConfigured()) return true;
  const v = getVerification(userId);
  if (!v) return false;
  if (v.subscriptionStatus !== "active" && v.subscriptionStatus !== "trialing") return false;
  if (stripeIdentityEnabled() && v.kycStatus !== "verified") return false;
  return true;
}
