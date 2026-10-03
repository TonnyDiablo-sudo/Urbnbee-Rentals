import "server-only";
import { getHostEntitlement } from "@/lib/host-entitlements-store";
import { primarySkuForPlan } from "@/lib/membership-entitlements";
import { membershipPublicPlans } from "@/lib/membership-plans-store";
import {
  MEMBERSHIP_FAMILY_UNIT,
  MEMBERSHIP_PLAN_FAMILY,
  type MembershipPlanCode,
  type MembershipPlanFamily,
} from "@/lib/membership-plans-types";
import type { UserRecord } from "@/lib/marketplace-types";
import { getVerification } from "@/lib/verification-store";
import type { VerificationRegion } from "@/lib/verification-types";

/** Lo que incluye cada producto, para el botón «¿Qué incluye?». */
const DETAILS: Record<MembershipPlanFamily, string[]> = {
  guest_pass: [
    "Un pago único que habilita una reserva.",
    "Ideal si viajas una vez y no quieres membresía.",
    "Si el anfitrión rechaza tu solicitud, el pase se te devuelve.",
  ],
  guest_membership: [
    "Es una sola por persona, seas huésped, anfitrión o las dos cosas.",
    "Verificamos tu identidad con tu INE o pasaporte.",
    "Como huésped: reservas ilimitadas mientras esté activa.",
    "Como anfitrión: listón «Miembro verificado» en todos tus anuncios.",
    "Entre más largo el plazo, más barato por mes.",
  ],
  host_verification: [
    "Verificamos tu identidad con tu INE o pasaporte.",
    "Listón «Miembro verificado» en todos tus anuncios.",
    "Tus anuncios se destacan frente a los no verificados.",
    "Entre más largo el plazo, más barato por mes.",
  ],
  booking_engine: [
    "Se paga por anuncio: eliges qué anuncios lo usan.",
    "Tus huéspedes reservan y pagan en línea: Stripe a tu cuenta o pago manual (transferencia, CLABE, Zelle).",
    "Contrato entre tú y tu huésped, firmado en línea y adaptado a la ley de tu estado y ciudad.",
    "Verificación de domicilio del anuncio incluida.",
    "Bloqueo automático de fechas y calendario.",
    "Asistente con IA de urbnbeeai que contesta preguntas de tus huéspedes.",
    "La dirección exacta se comparte sólo con la reserva confirmada.",
  ],
  cleaning_tool: [
    "Se paga por anuncio: los anuncios pagados entran a tu herramienta de limpieza.",
    "Cada reserva crea su limpieza para el día de salida, sin que hagas nada.",
    "Asignación automática a quien limpia ese anuncio, o manual si prefieres.",
    "Puedes pedir foto al terminar; quien limpia deja notas y te escribe por el chat.",
    "Tu equipo de limpieza va incluido: no paga asiento de colaborador.",
  ],
  collaborator_seat: [
    "Se paga por colaborador.",
    "La persona entra con su propia cuenta de Cabibee; tú la invitas por correo.",
    "Tú eliges sus roles: aceptar y verificar reservas, firmar contratos en tu nombre, contestar mensajes.",
    "Tú eliges a qué anuncios tiene acceso.",
    "Le quitas el acceso cuando quieras desde tu panel de colaboradores.",
  ],
  address_proof: [
    "Se paga por anuncio.",
    "Subes un comprobante de domicilio y lo revisamos.",
    "Tu anuncio muestra la insignia «Ubicación verificada».",
    "Si el anuncio tiene motor de reservas, ya viene incluida.",
  ],
};

export type StoreTerm = {
  code: MembershipPlanCode;
  /** 0 = pago único. */
  months: number;
  amount: number;
  perMonth: number;
};

export type StoreItem = {
  family: MembershipPlanFamily;
  label: string;
  description: string;
  details: string[];
  currency: "mxn" | "usd";
  audience: "guest" | "host";
  unit?: "listing" | "seat";
  terms: StoreTerm[];
  owned?: {
    status: string;
    quantity?: number;
    until?: string;
    /** Ya pidió cancelar: termina en `until` y no se renueva. */
    cancelAtPeriodEnd?: boolean;
    /** Plazo comprado; sin él no se sabe qué precio aplica. */
    code?: string;
    /** Es una suscripción que se renueva sola y se puede cancelar. */
    renews?: boolean;
  };
};

const FAMILY_ORDER: MembershipPlanFamily[] = [
  "booking_engine",
  "cleaning_tool",
  "collaborator_seat",
  "address_proof",
  "host_verification",
  "guest_membership",
  "guest_pass",
];

function stripTerm(label: string): string {
  return label.replace(/\s*·\s*\d+\s*mes(es)?$/i, "").replace(/\s+\d+\s*mes(es)?$/i, "").trim();
}

function ownedFor(user: UserRecord, family: MembershipPlanFamily, anyCode: MembershipPlanCode): StoreItem["owned"] {
  const sku = primarySkuForPlan(anyCode);
  if (sku) {
    const row = getHostEntitlement(user.id, sku);
    if (!row || row.status === "cancelled") return undefined;
    return {
      status: row.status,
      quantity: row.quantity,
      until: row.currentPeriodEnd,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd === true,
      code: row.planCode,
      renews: Boolean(row.stripeSubscriptionId) && row.source === "cabibee_direct",
    };
  }
  const v = getVerification(user.id);
  if (family === "guest_pass") {
    const n = v?.bookingPassesRemaining ?? 0;
    return n > 0 ? { status: "active", quantity: n } : undefined;
  }
  const s = v?.subscriptionStatus;
  return s === "active" || s === "trialing" || s === "past_due"
    ? {
        status: s,
        until: v?.currentPeriodEnd,
        cancelAtPeriodEnd: v?.cancelAtPeriodEnd === true,
        code: v?.planCode,
        renews: Boolean(v?.stripeSubscriptionId),
      }
    : undefined;
}

export function storeItemsFor(user: UserRecord, region: VerificationRegion): StoreItem[] {
  const isHost = user.role === "host" || user.role === "admin";
  const byFamily = new Map<MembershipPlanFamily, StoreItem>();
  for (const p of membershipPublicPlans(region)) {
    if (p.audience === "host" && !isHost) continue;
    const family = MEMBERSHIP_PLAN_FAMILY[p.code];
    // La identidad se vende una sola vez por persona, como «Verificación de identidad».
    if (family === "host_verification") continue;
    const months = p.billing.kind === "subscription" ? p.billing.intervalCount : 0;
    const term: StoreTerm = {
      code: p.code,
      months,
      amount: p.amount,
      perMonth: months ? Math.round((p.amount / months) * 100) / 100 : p.amount,
    };
    const item = byFamily.get(family);
    if (item) {
      item.terms.push(term);
      if (months === 1) item.label = stripTerm(p.label);
      continue;
    }
    byFamily.set(family, {
      family,
      label: stripTerm(p.label),
      description: p.description,
      details: DETAILS[family] ?? [],
      currency: p.currency,
      audience: p.audience,
      unit: MEMBERSHIP_FAMILY_UNIT[family],
      terms: [term],
      owned: ownedFor(user, family, p.code),
    });
  }
  for (const item of byFamily.values()) item.terms.sort((a, b) => a.months - b.months);
  return FAMILY_ORDER.filter((f) => byFamily.has(f)).map((f) => byFamily.get(f)!);
}
