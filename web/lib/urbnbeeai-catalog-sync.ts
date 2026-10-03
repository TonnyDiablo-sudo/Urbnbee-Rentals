import "server-only";
import {
  applyCatalogPublicFields,
  getCatalogSyncMeta,
  isMembershipPlanCode,
  listMembershipPlans,
  markCatalogPushed,
  markCatalogSynced,
} from "@/lib/membership-plans-store";
import type { MembershipPlanCode } from "@/lib/membership-plans-types";
import {
  fetchAdminCatalog,
  fetchPublicCatalog,
  patchAdminCatalog,
  urbnbeeaiCatalogConfigured,
  type CatalogAdminSku,
  type CatalogPublicSku,
} from "@/lib/urbnbeeai-catalog-client";

const TTL_MS = 5 * 60 * 1000;

/**
 * Los precios de Cabibee se deciden sólo en Cabibee: urbnbeeai nada más interviene en
 * su agente de IA. La sincronización queda apagada; el código se conserva por si algún
 * día se vuelve a compartir el catálogo.
 */
const CATALOG_SYNC_ENABLED = false;
const catalogSyncOn = () => CATALOG_SYNC_ENABLED && urbnbeeaiCatalogConfigured();

type AdminExtra = {
  floorPrice: number | null;
  sellerSellable: boolean;
  priceIsProvisional: boolean;
  updatedFrom: string | null;
  updatedBy: string | null;
  updatedAt: string;
};

const adminExtra = new Map<MembershipPlanCode, AdminExtra>();
let lastPublicOkAt = 0;
let lastAdminOkAt = 0;
let publicInflight: Promise<boolean> | null = null;
let adminInflight: Promise<boolean> | null = null;

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

function applyPublic(skus: CatalogPublicSku[]) {
  const localHas = listMembershipPlans().some((p) => p.amountMxn > 0 || p.amountUsd > 0);
  const remoteHas = skus.some((s) => s.public_price > 0 || s.public_price_mxn > 0);
  if (localHas && !remoteHas && !getCatalogSyncMeta().catalogPushedAt) {
    return;
  }
  for (const sku of skus) {
    if (!isMembershipPlanCode(sku.code)) continue;
    applyCatalogPublicFields(sku.code, {
      label: sku.label || sku.code,
      description: sku.description ?? "",
      amountMxn: money(sku.public_price_mxn),
      amountUsd: money(sku.public_price),
      active: sku.active === true,
    });
  }
  markCatalogSynced();
}

function applyAdmin(skus: CatalogAdminSku[]) {
  applyPublic(skus);
  for (const sku of skus) {
    if (!isMembershipPlanCode(sku.code)) continue;
    adminExtra.set(sku.code, {
      floorPrice:
        sku.floor_price === null || sku.floor_price === undefined || !Number.isFinite(sku.floor_price)
          ? null
          : money(sku.floor_price),
      sellerSellable: sku.seller_sellable === true,
      priceIsProvisional: sku.price_is_provisional === true,
      updatedFrom: sku.updated_from,
      updatedBy: sku.updated_by,
      updatedAt: sku.updated_at,
    });
  }
}

export function catalogAdminExtra(code: MembershipPlanCode): AdminExtra | undefined {
  return adminExtra.get(code);
}

export function catalogAdminExtras(): Record<string, AdminExtra> {
  return Object.fromEntries(adminExtra.entries());
}

/** Nunca incluye el piso. */
export async function ensurePublicCatalogFresh(): Promise<{
  configured: boolean;
  live: boolean;
}> {
  if (!catalogSyncOn()) return { configured: false, live: false };
  if (Date.now() - lastPublicOkAt < TTL_MS) return { configured: true, live: true };
  if (publicInflight) {
    const live = await publicInflight;
    return { configured: true, live };
  }
  publicInflight = (async () => {
    try {
      const skus = await fetchPublicCatalog();
      applyPublic(skus);
      lastPublicOkAt = Date.now();
      return true;
    } catch (e) {
      console.warn("[c7 catalog] público no disponible, uso caché:", e instanceof Error ? e.message : e);
      return lastPublicOkAt > 0 || Boolean(getCatalogSyncMeta().catalogSyncedAt);
    } finally {
      publicInflight = null;
    }
  })();
  const live = await publicInflight;
  return { configured: true, live };
}

export async function ensureAdminCatalogFresh(adminEmail: string): Promise<{
  configured: boolean;
  live: boolean;
}> {
  if (!catalogSyncOn()) return { configured: false, live: false };
  if (Date.now() - lastAdminOkAt < TTL_MS && adminExtra.size > 0) {
    return { configured: true, live: true };
  }
  if (adminInflight) {
    const live = await adminInflight;
    return { configured: true, live };
  }
  adminInflight = (async () => {
    try {
      await pushLocalPricesIfRemoteEmpty(adminEmail);
      const skus = await fetchAdminCatalog(adminEmail);
      applyAdmin(skus);
      lastAdminOkAt = Date.now();
      lastPublicOkAt = Date.now();
      return true;
    } catch (e) {
      console.warn("[c7 catalog] admin no disponible, uso caché:", e instanceof Error ? e.message : e);
      return lastAdminOkAt > 0;
    } finally {
      adminInflight = null;
    }
  })();
  const live = await adminInflight;
  return { configured: true, live };
}

/**
 * Si urbnbeeai está en ceros (migración) y aquí ya hay montos, los sube una vez.
 * No pisa un precio remoto que ya no es provisional.
 */
async function pushLocalPricesIfRemoteEmpty(adminEmail: string) {
  if (getCatalogSyncMeta().catalogPushedAt) return;
  let remote: CatalogAdminSku[];
  try {
    remote = await fetchAdminCatalog(adminEmail);
  } catch {
    return;
  }
  const byCode = new Map(remote.map((s) => [s.code, s]));
  let pushed = false;
  for (const plan of listMembershipPlans()) {
    const rem = byCode.get(plan.code);
    if (!rem) continue;
    const localHas = plan.amountMxn > 0 || plan.amountUsd > 0;
    const remoteEmpty = (rem.public_price ?? 0) <= 0 && (rem.public_price_mxn ?? 0) <= 0;
    if (!localHas || !remoteEmpty) continue;
    const res = await patchAdminCatalog(
      plan.code,
      {
        public_price: plan.amountUsd,
        public_price_mxn: plan.amountMxn,
        active: plan.active,
        label: plan.label,
        description: plan.description,
      },
      adminEmail
    );
    if (res.ok) pushed = true;
    else console.warn("[c7 catalog] no pude subir", plan.code, res.error);
  }
  if (
    pushed ||
    remote.some((r) => (r.public_price ?? 0) > 0 || (r.public_price_mxn ?? 0) > 0)
  ) {
    markCatalogPushed();
  }
}

export async function savePlanToCatalog(
  code: MembershipPlanCode,
  input: {
    label: string;
    description: string;
    amountMxn: number;
    amountUsd: number;
    active: boolean;
    floorPrice: number | null;
  },
  adminEmail: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!catalogSyncOn()) {
    return { ok: false, error: "Falta CABIBEE_TO_URBNBEEAI_API_SECRET en Cabibee y en urbnbeeai.", status: 503 };
  }
  const res = await patchAdminCatalog(
    code,
    {
      public_price: input.amountUsd,
      public_price_mxn: input.amountMxn,
      floor_price: input.floorPrice,
      active: input.active,
      label: input.label,
      description: input.description,
    },
    adminEmail
  );
  if (!res.ok) return { ok: false, error: res.error ?? "No se pudo guardar en urbnbeeai.", status: res.status };
  applyCatalogPublicFields(code, {
    label: input.label,
    description: input.description,
    amountMxn: input.amountMxn,
    amountUsd: input.amountUsd,
    active: input.active,
  });
  adminExtra.set(code, {
    floorPrice: input.floorPrice,
    sellerSellable: catalogAdminExtra(code)?.sellerSellable ?? false,
    priceIsProvisional: false,
    updatedFrom: "cabibee_admin",
    updatedBy: adminEmail,
    updatedAt: new Date().toISOString(),
  });
  lastAdminOkAt = 0;
  lastPublicOkAt = 0;
  markCatalogSynced();
  return { ok: true };
}

export function startCatalogRefreshWorker() {
  if (!catalogSyncOn()) return;
  void ensurePublicCatalogFresh();
  setInterval(() => {
    void ensurePublicCatalogFresh();
  }, TTL_MS);
}
