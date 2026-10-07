import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { FAMILY_COPY } from "@/lib/membership-plans-store";
import {
  DEFAULT_BANNER_TEXT,
  DEFAULT_RIBBON_TEXT,
  DISCOUNT_PCT_MAX,
  DISCOUNT_PCT_MIN,
  PROMO_BANNER_MAX,
  PROMO_FAMILIES,
  PROMO_RIBBON_MAX,
  saveStorePromo,
  storePromo,
} from "@/lib/store-promo-store";

export const dynamic = "force-dynamic";

async function isAdmin() {
  const user = await getSessionUser();
  return Boolean(user && user.role === "admin");
}

function payload() {
  return {
    ...storePromo(),
    products: PROMO_FAMILIES.filter((f) => f !== "host_verification").map((f) => ({ family: f, label: FAMILY_COPY[f].label })),
    limits: { ribbon: PROMO_RIBBON_MAX, banner: PROMO_BANNER_MAX, pctMin: DISCOUNT_PCT_MIN, pctMax: DISCOUNT_PCT_MAX },
    defaults: { ribbon: DEFAULT_RIBBON_TEXT, banner: DEFAULT_BANNER_TEXT },
  };
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(payload());
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as {
    banner?: { on?: unknown; text?: unknown };
    ribbons?: Record<string, { on?: unknown; text?: unknown }>;
    discountPct?: unknown;
  };
  const pick = (r?: { on?: unknown; text?: unknown }) => ({
    on: typeof r?.on === "boolean" ? r.on : undefined,
    text: typeof r?.text === "string" ? r.text : undefined,
  });
  saveStorePromo({
    banner: body.banner ? pick(body.banner) : undefined,
    ribbons: Object.fromEntries(Object.entries(body.ribbons ?? {}).map(([k, v]) => [k, pick(v)])),
    discountPct: body.discountPct,
  });
  return NextResponse.json({ ok: true, ...payload() });
}
