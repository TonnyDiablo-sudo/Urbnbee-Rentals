import "server-only";
import type Stripe from "stripe";
import {
  getMembershipPlan,
  listMembershipPlans,
  updateMembershipPlan,
} from "@/lib/membership-plans-store";
import type { MembershipPlanCode, MembershipPlanRecord } from "@/lib/membership-plans-types";
import { getStripe } from "@/lib/stripe-server";

const LOG = "[stripe-membership-products]";
const META_KEY = "cabibee_plan";

/**
 * Reencuentra el Producto de un plan cuyo id se perdió del catálogo.
 *
 * Sin esta búsqueda, restaurar un respaldo viejo del volumen llenaría Stripe de
 * Productos gemelos, y el huésped vería cobros con nombres repetidos.
 */
async function findProductByPlanCode(
  stripe: Stripe,
  code: MembershipPlanCode
): Promise<Stripe.Product | null> {
  try {
    const res = await stripe.products.search({
      query: `metadata['${META_KEY}']:'${code}' AND active:'true'`,
      limit: 1,
    });
    return res.data[0] ?? null;
  } catch (e) {
    // La búsqueda tarda en indexar lo recién creado, así que no encontrar nada no
    // prueba que no exista. Se sigue al camino de crear, que es idempotente por id.
    console.warn(`${LOG} búsqueda fallida para ${code}:`, e);
    return null;
  }
}

/**
 * Devuelve el Producto del plan, creándolo si hace falta, y guarda su id.
 *
 * Tres intentos en orden de costo: el id guardado, la búsqueda por metadata, y crear.
 * El id guardado se verifica contra Stripe porque puede apuntar a otra cuenta — el
 * caso típico es una clave de prueba estrenada contra datos de producción.
 */
export async function ensureMembershipProduct(
  stripe: Stripe,
  plan: MembershipPlanRecord
): Promise<Stripe.Product> {
  if (plan.stripeProductId) {
    try {
      const saved = await stripe.products.retrieve(plan.stripeProductId);
      if (saved.active) {
        // El nombre lo manda el catálogo: si lo cambiaste en el admin, el recibo
        // de Stripe tiene que decir lo mismo.
        if (saved.name !== plan.label) {
          try {
            return await stripe.products.update(saved.id, { name: plan.label });
          } catch (e) {
            console.warn(`${LOG} no se pudo renombrar ${saved.id}:`, e);
          }
        }
        return saved;
      }
    } catch {
      /* No existe en esta cuenta: se busca y, si hace falta, se crea. */
    }
  }

  const product =
    (await findProductByPlanCode(stripe, plan.code)) ??
    (await stripe.products.create({
      name: plan.label,
      description: plan.description || undefined,
      metadata: { [META_KEY]: plan.code },
    }));

  if (product.id !== plan.stripeProductId) {
    updateMembershipPlan(plan.code, { stripeProductId: product.id });
  }
  return product;
}

export type MembershipProductSyncResult = {
  considered: number;
  ready: number;
  failed: number;
  detail: { code: MembershipPlanCode; label: string; productId?: string; error?: string }[];
};

/**
 * Asegura Producto en Stripe para cada plan del catálogo.
 *
 * No crea Precios a propósito: un Price es inmutable y habría que archivarlo cada
 * vez que cambia el monto. Aquí el monto viaja en el cobro.
 */
export async function ensureAllMembershipProducts(): Promise<MembershipProductSyncResult> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe no está configurado (falta STRIPE_SECRET_KEY).");

  const out: MembershipProductSyncResult = { considered: 0, ready: 0, failed: 0, detail: [] };

  for (const plan of listMembershipPlans()) {
    out.considered++;
    try {
      const product = await ensureMembershipProduct(stripe, plan);
      out.ready++;
      out.detail.push({ code: plan.code, label: plan.label, productId: product.id });
    } catch (e) {
      out.failed++;
      console.error(`${LOG} falló ${plan.code}:`, e);
      out.detail.push({
        code: plan.code,
        label: plan.label,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return out;
}

/** Producto listo para cobrar este plan, provisionándolo al vuelo si falta. */
export async function membershipProductIdForCheckout(
  stripe: Stripe,
  code: MembershipPlanCode
): Promise<string | null> {
  const plan = getMembershipPlan(code);
  if (!plan) return null;
  if (plan.stripeProductId) return plan.stripeProductId;
  try {
    const product = await ensureMembershipProduct(stripe, plan);
    return product.id;
  } catch (e) {
    console.warn(`${LOG} no se pudo provisionar el producto de ${code} al cobrar:`, e);
    return null;
  }
}
