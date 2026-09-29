import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getScreeningPrice, updateScreeningPrice } from "@/lib/screening-store";
import { getStripe } from "@/lib/stripe-server";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({
    screening: getScreeningPrice(),
    stripeConfigured: Boolean(getStripe()),
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    providerCostMxn?: unknown;
    markupMxn?: unknown;
    providerCostUsd?: unknown;
    markupUsd?: unknown;
    active?: unknown;
  };
  const next = updateScreeningPrice({
    providerCostMxn: body.providerCostMxn !== undefined ? Number(body.providerCostMxn) : undefined,
    markupMxn: body.markupMxn !== undefined ? Number(body.markupMxn) : undefined,
    providerCostUsd: body.providerCostUsd !== undefined ? Number(body.providerCostUsd) : undefined,
    markupUsd: body.markupUsd !== undefined ? Number(body.markupUsd) : undefined,
    active: typeof body.active === "boolean" ? body.active : undefined,
  });
  return NextResponse.json({ ok: true, screening: next });
}
