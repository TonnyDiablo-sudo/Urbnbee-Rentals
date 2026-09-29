/**
 * Catálogo de membresías, con el precio editable desde /admin/pricing.
 *
 * Hay dos audiencias y se cobran las dos: el huésped paga por poder reservar, y el
 * anfitrión paga por el listón «Miembro verificado» en sus anuncios.
 *
 * ─── Por qué el precio no vive en Stripe ─────────────────────────────────────
 *
 * El monto de un Price de Stripe es inmutable: "cambiar el precio" por esa vía
 * obliga a crear un Price nuevo, apuntar la app a ése y archivar el viejo, sin
 * poder borrarlo porque las suscripciones que ya cobran con él lo siguen usando.
 * Stripe sí acepta un monto libre en el renglón del cobro, pero exige el Producto:
 * el "cuánto" es libre, el "de qué es" no.
 *
 * De ahí el reparto: en Stripe vive el Producto (el nombre), y el monto sale de
 * este catálogo en el momento de cobrar. Mover un precio es editar un número.
 */

export type MembershipPlanCode =
  | "pase_reserva"
  | "meses_6"
  | "meses_12"
  | "anfitrion_6"
  | "anfitrion_12";

export const MEMBERSHIP_PLAN_CODES: MembershipPlanCode[] = [
  "pase_reserva",
  "meses_6",
  "meses_12",
  "anfitrion_6",
  "anfitrion_12",
];

/** A quién le vende cada plan. Determina qué desbloquea el pago. */
export type MembershipAudience = "guest" | "host";

export const MEMBERSHIP_PLAN_AUDIENCE: Record<MembershipPlanCode, MembershipAudience> = {
  pase_reserva: "guest",
  meses_6: "guest",
  meses_12: "guest",
  anfitrion_6: "host",
  anfitrion_12: "host",
};

/**
 * Cómo se cobra cada plan. No es editable porque no es precio: cambiarlo
 * convertiría una suscripción en un pago único y al revés, y las suscripciones
 * que ya existen seguirían cobrando con la forma vieja.
 */
export type MembershipPlanBilling =
  | { kind: "one_time" }
  | { kind: "subscription"; intervalCount: number };

export const MEMBERSHIP_PLAN_BILLING: Record<MembershipPlanCode, MembershipPlanBilling> = {
  pase_reserva: { kind: "one_time" },
  meses_6: { kind: "subscription", intervalCount: 6 },
  meses_12: { kind: "subscription", intervalCount: 12 },
  anfitrion_6: { kind: "subscription", intervalCount: 6 },
  anfitrion_12: { kind: "subscription", intervalCount: 12 },
};

export type MembershipPlanRecord = {
  code: MembershipPlanCode;
  /** Lo que lee quien compra. Es también el nombre del Producto en Stripe. */
  label: string;
  description: string;
  /** Monto en pesos. 0 = no se ofrece en México. */
  amountMxn: number;
  /** Monto en dólares. 0 = no se ofrece en Estados Unidos. */
  amountUsd: number;
  /** Producto de Stripe. Sin él no se puede cobrar con monto libre. */
  stripeProductId?: string;
  active: boolean;
  updatedAt: string;
  updatedByUserId?: string;
};

export type MembershipPlansSnapshot = {
  version: 1;
  plans: MembershipPlanRecord[];
};
