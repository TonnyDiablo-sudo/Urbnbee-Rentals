import "server-only";
import { MEMBERSHIP_PLAN_CODES, type MembershipPlanCode } from "@/lib/membership-plans-types";

function isMembershipPlanCode(code: string): code is MembershipPlanCode {
  return MEMBERSHIP_PLAN_CODES.includes(code as MembershipPlanCode);
}

const DEFAULT_BASE = "https://www.urbnbeeai.com/api/integrations/cabibee/v1";
const FETCH_MS = 12_000;

export type CatalogBilling =
  | { kind: "one_time" }
  | { kind: "subscription"; interval_count: number };

export type CatalogPublicSku = {
  sku: string;
  code: string;
  audience: "guest" | "host";
  label: string;
  description: string;
  public_price: number;
  public_price_mxn: number;
  billing: CatalogBilling;
  active: boolean;
};

export type CatalogAdminSku = CatalogPublicSku & {
  floor_price: number | null;
  seller_sellable: boolean;
  price_is_provisional: boolean;
  updated_at: string;
  updated_from: string | null;
  updated_by: string | null;
};

export type CatalogPatchBody = {
  public_price?: number;
  public_price_mxn?: number;
  floor_price?: number | null;
  active?: boolean;
  label?: string;
  description?: string;
};

function catalogSecret(): string | undefined {
  return process.env.CABIBEE_TO_URBNBEEAI_API_SECRET?.trim() || undefined;
}

export function urbnbeeaiCatalogConfigured(): boolean {
  return Boolean(catalogSecret());
}

export function urbnbeeaiCatalogBaseUrl(): string {
  const explicit = process.env.URBNBEEAI_CATALOG_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const origin = process.env.URBNBEEAI_ORIGIN?.trim();
  if (origin) return `${origin.replace(/\/$/, "")}/api/integrations/cabibee/v1`;
  return DEFAULT_BASE;
}

function asCode(sku: { code?: string; sku?: string }): MembershipPlanCode | null {
  const code = String(sku.code ?? "").trim();
  if (isMembershipPlanCode(code)) return code;
  const raw = String(sku.sku ?? "").replace(/^cabibee_/, "");
  return isMembershipPlanCode(raw) ? raw : null;
}

async function catalogFetch(path: string, init: RequestInit, adminEmail?: string): Promise<Response> {
  const secret = catalogSecret();
  if (!secret) throw new Error("cabibee_integration_not_configured");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${secret}`);
  headers.set("Accept", "application/json");
  if (adminEmail) headers.set("X-Cabibee-Admin-Email", adminEmail);
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_MS);
  try {
    return await fetch(`${urbnbeeaiCatalogBaseUrl()}${path}`, {
      ...init,
      headers,
      signal: ac.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(t);
  }
}

function parseSkus(json: unknown): unknown[] {
  if (!json || typeof json !== "object") return [];
  const skus = (json as { skus?: unknown }).skus;
  return Array.isArray(skus) ? skus : [];
}

function asPublicSku(raw: unknown): CatalogPublicSku | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const code = asCode({ code: String(r.code ?? ""), sku: String(r.sku ?? "") });
  if (!code) return null;
  const billingRaw = r.billing;
  let billing: CatalogBilling = { kind: "one_time" };
  if (billingRaw && typeof billingRaw === "object") {
    const b = billingRaw as { kind?: string; interval_count?: number };
    billing =
      b.kind === "subscription"
        ? { kind: "subscription", interval_count: Number(b.interval_count) || 1 }
        : { kind: "one_time" };
  }
  return {
    sku: String(r.sku ?? `cabibee_${code}`),
    code,
    audience: r.audience === "host" ? "host" : "guest",
    label: String(r.label ?? ""),
    description: String(r.description ?? ""),
    public_price: Number(r.public_price) || 0,
    public_price_mxn: Number(r.public_price_mxn) || 0,
    billing,
    active: r.active === true,
  };
}

function asAdminSku(raw: unknown): CatalogAdminSku | null {
  const pub = asPublicSku(raw);
  if (!pub || !raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const floor = r.floor_price;
  return {
    ...pub,
    floor_price: floor === null || floor === undefined || floor === "" ? null : Number(floor),
    seller_sellable: r.seller_sellable === true,
    price_is_provisional: r.price_is_provisional === true,
    updated_at: String(r.updated_at ?? ""),
    updated_from: r.updated_from == null ? null : String(r.updated_from),
    updated_by: r.updated_by == null ? null : String(r.updated_by),
  };
}

export async function fetchPublicCatalog(): Promise<CatalogPublicSku[]> {
  const res = await catalogFetch("/catalog", { method: "GET" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: string; code?: string }).code ?? (json as { error?: string }).error;
    throw new Error(err || `catalog_${res.status}`);
  }
  return parseSkus(json).map(asPublicSku).filter((s): s is CatalogPublicSku => Boolean(s));
}

export async function fetchAdminCatalog(adminEmail: string): Promise<CatalogAdminSku[]> {
  const res = await catalogFetch("/admin/catalog", { method: "GET" }, adminEmail);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: string; code?: string }).code ?? (json as { error?: string }).error;
    throw new Error(err || `admin_catalog_${res.status}`);
  }
  return parseSkus(json).map(asAdminSku).filter((s): s is CatalogAdminSku => Boolean(s));
}

export async function patchAdminCatalog(
  skuOrCode: string,
  body: CatalogPatchBody,
  adminEmail: string
): Promise<{ ok: boolean; sku?: string; error?: string; status: number }> {
  const res = await catalogFetch(`/admin/catalog/${encodeURIComponent(skuOrCode)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, adminEmail);
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; sku?: string; error?: string };
  if (!res.ok) {
    return { ok: false, error: json.error ?? `admin_catalog_patch_${res.status}`, status: res.status };
  }
  return { ok: true, sku: json.sku, status: res.status };
}
