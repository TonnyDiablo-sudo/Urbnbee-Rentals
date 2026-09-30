import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import type {
  GuestVerificationRecord,
  VerificationRegion,
  VerificationSubscriptionStatus,
} from "@/lib/verification-types";
import {
  applyHostEntitlement,
  getHostEntitlement,
  HOST_SKU_BOOKING_ENGINE,
  hostEntitlementAllowsAccess,
} from "@/lib/host-entitlements";
import { membershipCatalogHasPricedPlan } from "@/lib/membership-plans-store";
import { scheduleMysql, upsertVerificationRow } from "@/lib/mysql-sync";
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
    scheduleMysql(async () => {
      for (const r of snapshot.verifications) await upsertVerificationRow(r);
    });
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
    hostVerifiedAt: patch.hostVerifiedAt ?? prev?.hostVerifiedAt,
    hostVerificationSource: patch.hostVerificationSource ?? prev?.hostVerificationSource,
    hostSubscriptionStatus: patch.hostSubscriptionStatus ?? prev?.hostSubscriptionStatus,
    hostStripeSubscriptionId: patch.hostStripeSubscriptionId ?? prev?.hostStripeSubscriptionId,
    hostCurrentPeriodEnd: patch.hostCurrentPeriodEnd ?? prev?.hostCurrentPeriodEnd,
    bookingPassesRemaining: patch.bookingPassesRemaining ?? prev?.bookingPassesRemaining,
    grantedPassSessionIds: patch.grantedPassSessionIds ?? prev?.grantedPassSessionIds,
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

/**
 * ¿Hay que estar verificado para reservar?
 *
 * Sí en cuanto exista algo que vender: un plan del catálogo o los price IDs legado.
 * Se mira el legado además del catálogo porque si no, migrar a precios editables
 * abriría las reservas a cualquiera hasta que alguien escribiera el primer monto.
 *
 * Basta con que el plan tenga precio; no se exige que su Producto de Stripe ya esté
 * provisionado. Si se exigiera, una sincronización fallida apagaría el candado y
 * dejaría reservar gratis: el modo de fallar correcto es bloquear, no abrir.
 */
export function membershipRequiredToBook(): boolean {
  // Sólo planes de huésped: si se mirara el catálogo entero, encender la membresía
  // del anfitrión cerraría las reservas a quien aún no tiene que pagar.
  return membershipCatalogHasPricedPlan("guest") || verificationSubscriptionConfigured();
}

export type GuestBookingAccess = {
  allowed: boolean;
  /** Con qué se entra: `open` = el sitio todavía no vende membresía. */
  via: "open" | "subscription" | "pass";
  needsMembership: boolean;
  needsIdentity: boolean;
};

/**
 * Con qué derecho reserva este huésped.
 *
 * Devuelve el `via` y no sólo un booleano porque el pase se consume al reservar:
 * quien llama necesita saber si la reserva se pagó con un pase para descontarlo.
 */
export function resolveGuestBookingAccess(userId: string): GuestBookingAccess {
  if (!membershipRequiredToBook()) {
    return { allowed: true, via: "open", needsMembership: false, needsIdentity: false };
  }
  const v = getVerification(userId);
  const subOk = v?.subscriptionStatus === "active" || v?.subscriptionStatus === "trialing";
  const passOk = (v?.bookingPassesRemaining ?? 0) > 0;
  // La suscripción se gasta antes que el pase: el pase es el recurso escaso.
  const via = subOk ? "subscription" : "pass";
  const needsMembership = !subOk && !passOk;
  const needsIdentity = !needsMembership && stripeIdentityEnabled() && v?.kycStatus !== "verified";
  return { allowed: !needsMembership && !needsIdentity, via, needsMembership, needsIdentity };
}

/** Puede reservar: suscripción activa, o un pase sin usar, más KYC si está exigido. */
export function isGuestEligibleToBook(userId: string): boolean {
  return resolveGuestBookingAccess(userId).allowed;
}

/**
 * Acredita un pase comprado. Idempotente por sesión de Checkout, porque el mismo
 * pago llega dos veces: por el regreso del huésped y por el webhook.
 */
/** Pase de cortesía (admin / prueba). No pasa por Stripe. */
export function grantComplimentaryBookingPass(userId: string, note = "admin"): boolean {
  const key = `comp_${note}_${Date.now()}`;
  return grantBookingPass(userId, key);
}

export function grantBookingPass(userId: string, checkoutSessionId: string): boolean {
  const v = getVerification(userId);
  const already = v?.grantedPassSessionIds ?? [];
  if (already.includes(checkoutSessionId)) return false;
  upsertVerification(userId, {
    bookingPassesRemaining: (v?.bookingPassesRemaining ?? 0) + 1,
    // Se recorta para que el archivo no crezca sin límite; 100 pases de historia
    // sobran para detectar un reintento, que ocurre en minutos.
    grantedPassSessionIds: [...already, checkoutSessionId].slice(-100),
  });
  return true;
}

/** Descuenta un pase al crear la reserva. `false` si no había ninguno. */
export function consumeBookingPass(userId: string): boolean {
  const v = getVerification(userId);
  const left = v?.bookingPassesRemaining ?? 0;
  if (left <= 0) return false;
  upsertVerification(userId, { bookingPassesRemaining: left - 1 });
  return true;
}

export function isHostIdentityVerified(userId: string): boolean {
  return Boolean(getVerification(userId)?.hostVerifiedAt);
}

function entitlementStatusFromLegacy(
  status: VerificationSubscriptionStatus | undefined
): "active" | "past_due" | "cancelled" | null {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due") return "past_due";
  if (status === "canceled" || status === "unpaid") return "cancelled";
  return null;
}

function backfillEngineFromLegacyMembership(hostId: string) {
  if (getHostEntitlement(hostId, HOST_SKU_BOOKING_ENGINE)) return;
  const v = getVerification(hostId);
  const mapped = entitlementStatusFromLegacy(v?.hostSubscriptionStatus);
  if (!mapped || mapped === "cancelled") return;
  applyHostEntitlement({
    hostId,
    sku: HOST_SKU_BOOKING_ENGINE,
    status: mapped,
    source: "cabibee_direct",
    stripeSubscriptionId: v?.hostStripeSubscriptionId,
    currentPeriodEnd: v?.hostCurrentPeriodEnd,
  });
}

export function isHostMembershipActive(userId: string): boolean {
  backfillEngineFromLegacyMembership(userId);
  const engine = getHostEntitlement(userId, HOST_SKU_BOOKING_ENGINE);
  if (engine) return hostEntitlementAllowsAccess(engine.status);
  const s = getVerification(userId)?.hostSubscriptionStatus;
  return s === "active" || s === "trialing" || s === "past_due";
}

/**
 * El motor lo enciende `cabibee_booking_engine`. Mientras el catálogo no venda
 * un plan de anfitrión, el candado queda abierto: si se cerrara, nadie podría
 * reservar porque el founder aún no cobra el motor.
 */
export function hostAcceptsBookings(hostId: string): boolean {
  backfillEngineFromLegacyMembership(hostId);
  const engine = getHostEntitlement(hostId, HOST_SKU_BOOKING_ENGINE);
  if (engine) return hostEntitlementAllowsAccess(engine.status);
  if (!membershipCatalogHasPricedPlan("host")) return true;
  return false;
}

/**
 * El listón «Miembro verificado» pide las dos cosas: identidad comprobada y
 * membresía de anfitrión vigente. Una sola no basta: si no, el sello se daría gratis.
 */
export function hostShowsVerifiedRibbon(userId: string): boolean {
  return isHostIdentityVerified(userId) && isHostMembershipActive(userId);
}

/** @deprecated Usa hostShowsVerifiedRibbon o isHostIdentityVerified. */
export function isHostVerified(userId: string): boolean {
  return hostShowsVerifiedRibbon(userId);
}

export function setHostMembershipFields(
  userId: string,
  fields: {
    hostSubscriptionStatus: VerificationSubscriptionStatus;
    hostStripeSubscriptionId?: string;
    hostCurrentPeriodEnd?: string;
    stripeCustomerId?: string;
  }
): GuestVerificationRecord {
  return upsertVerification(userId, fields);
}

/**
 * Marca o desmarca al anfitrión como verificado.
 *
 * No pasa por `upsertVerification` porque ése fusiona con `??` y no podría borrar la
 * marca: revocar una insignia tiene que ser posible.
 */
export function setHostVerification(
  userId: string,
  value: { verified: true; source: "identity" | "admin" } | { verified: false }
): GuestVerificationRecord {
  syncIfStale();
  const prev = rows.get(userId);
  const base: GuestVerificationRecord = prev ?? {
    userId,
    subscriptionStatus: "none",
    kycStatus: "not_started",
    updatedAt: nowIso(),
  };
  const next: GuestVerificationRecord = {
    ...base,
    hostVerifiedAt: value.verified ? (base.hostVerifiedAt ?? nowIso()) : undefined,
    hostVerificationSource: value.verified ? value.source : undefined,
    updatedAt: nowIso(),
  };
  rows.set(userId, next);
  persist();
  return next;
}

/** Devuelve el pase cuando la reserva que lo gastó no llegó a existir. */
export function restoreBookingPass(userId: string): void {
  const v = getVerification(userId);
  upsertVerification(userId, { bookingPassesRemaining: (v?.bookingPassesRemaining ?? 0) + 1 });
}
