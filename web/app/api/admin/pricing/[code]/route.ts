import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import {
  getMembershipPlan,
  isMembershipPlanCode,
  updateMembershipPlan,
} from "@/lib/membership-plans-store";
import { ensureMembershipProduct } from "@/lib/stripe-membership-products";
import { getStripe } from "@/lib/stripe-server";
import { urbnbeeaiCatalogConfigured } from "@/lib/urbnbeeai-catalog-client";
import { URBNBEEAI_CATALOG_CODES } from "@/lib/membership-plans-types";
import { catalogAdminExtra, savePlanToCatalog } from "@/lib/urbnbeeai-catalog-sync";

export const dynamic = "force-dynamic";

const MAX_AMOUNT = 999_999;

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

/**
 * Cambia precio, nombre o disponibilidad de un plan.
 *
 * Nada se descarta en silencio: un campo con valor inválido devuelve 400 en vez de
 * guardarse a medias. El modo de cobro (pago único contra suscripción) no se edita
 * acá: cambiarlo mutaría la naturaleza de un plan que ya tiene gente suscrita.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { code } = await ctx.params;
  if (!isMembershipPlanCode(code)) {
    return NextResponse.json({ error: "Ese plan no existe." }, { status: 404 });
  }
  const current = getMembershipPlan(code);
  if (!current) {
    return NextResponse.json({ error: "Ese plan no existe." }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const readAmount = (key: "amountMxn" | "amountUsd"): number | { error: string } => {
    if (body[key] === undefined) return current[key];
    const raw = body[key];
    if (raw === null || String(raw).trim() === "") return 0;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) {
      return { error: `${key} debe ser un número entre 0 y ${MAX_AMOUNT}, o ir vacío para no ofrecerlo.` };
    }
    // Dos decimales: Stripe cobra en centavos y más decimales se perderían sin avisar.
    return Math.round(n * 100) / 100;
  };

  const mxn = readAmount("amountMxn");
  if (typeof mxn === "object") return bad(mxn.error);
  const usd = readAmount("amountUsd");
  if (typeof usd === "object") return bad(usd.error);

  let label = current.label;
  if (body.label !== undefined) {
    const s = String(body.label ?? "").trim();
    if (!s) return bad("El nombre no puede quedar vacío: es lo que el huésped ve en Stripe.");
    label = s.slice(0, 160);
  }

  let description = current.description;
  if (body.description !== undefined) {
    description = String(body.description ?? "").trim().slice(0, 500);
  }

  let active = current.active;
  if (body.active !== undefined) {
    active = body.active === true || body.active === 1 || body.active === "1";
  }

  // Un plan encendido sin precio en ninguna región no se puede comprar, y aparecería
  // en la página como una opción que no lleva a ningún lado.
  if (active && mxn <= 0 && usd <= 0) {
    return bad("Para encender el plan ponle precio en México, en Estados Unidos, o en ambos.");
  }

  let floorPrice: number | null = catalogAdminExtra(code)?.floorPrice ?? null;
  if (body.floorPrice !== undefined) {
    if (body.floorPrice === null || String(body.floorPrice).trim() === "") {
      floorPrice = null;
    } else {
      const n = Number(body.floorPrice);
      if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) {
        return bad(`floorPrice debe ser un número entre 0 y ${MAX_AMOUNT}, o ir vacío.`);
      }
      floorPrice = Math.round(n * 100) / 100;
      if (usd > 0 && floorPrice > usd) {
        return bad("El piso no puede ser mayor que el precio público en USD.");
      }
    }
  }

  if (urbnbeeaiCatalogConfigured() && URBNBEEAI_CATALOG_CODES.includes(code)) {
    const saved = await savePlanToCatalog(
      code,
      { label, description, amountMxn: mxn, amountUsd: usd, active, floorPrice },
      user.email
    );
    if (!saved.ok) {
      return NextResponse.json({ error: saved.error }, { status: saved.status });
    }
  }

  const next = updateMembershipPlan(code, { label, description, amountMxn: mxn, amountUsd: usd, active });
  if (!next) {
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }

  // El Producto se asegura al encender el plan, porque sin él el cobro con monto
  // libre falla. Es best-effort: el precio ya quedó guardado y la respuesta dice si
  // falta sincronizar.
  let stripeSync: { ok: boolean; productId?: string; error?: string } | undefined;
  const stripe = getStripe();
  if (active && stripe) {
    try {
      const product = await ensureMembershipProduct(stripe, next);
      stripeSync = { ok: true, productId: product.id };
    } catch (e) {
      stripeSync = { ok: false, error: e instanceof Error ? e.message : String(e) };
      console.error(`[admin pricing PATCH] producto de ${code}:`, e);
    }
  }

  return NextResponse.json({
    ok: true,
    plan: { ...(stripeSync?.productId ? { ...next, stripeProductId: stripeSync.productId } : next) },
    stripeSync,
  });
}
