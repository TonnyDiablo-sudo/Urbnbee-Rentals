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
  | "meses_1"
  | "meses_6"
  | "meses_12"
  | "anfitrion_1"
  | "anfitrion_6"
  | "anfitrion_12"
  | "booking_engine"
  | "booking_engine_6"
  | "booking_engine_12"
  | "cleaning_tool"
  | "cleaning_tool_6"
  | "cleaning_tool_12"
  | "collaborator_seat"
  | "collaborator_seat_6"
  | "collaborator_seat_12"
  | "address_proof"
  | "address_proof_6"
  | "address_proof_12"
  | "featured_listing"
  | "featured_listing_6"
  | "featured_listing_12";

export const MEMBERSHIP_PLAN_CODES: MembershipPlanCode[] = [
  "pase_reserva",
  "meses_1",
  "meses_6",
  "meses_12",
  "anfitrion_1",
  "anfitrion_6",
  "anfitrion_12",
  "booking_engine",
  "booking_engine_6",
  "booking_engine_12",
  "cleaning_tool",
  "cleaning_tool_6",
  "cleaning_tool_12",
  "collaborator_seat",
  "collaborator_seat_6",
  "collaborator_seat_12",
  "address_proof",
  "address_proof_6",
  "address_proof_12",
  "featured_listing",
  "featured_listing_6",
  "featured_listing_12",
];

/** Todos los precios viven en Cabibee: urbnbeeai sólo interviene en su agente de IA. */
export const URBNBEEAI_CATALOG_CODES: MembershipPlanCode[] = [];

/**
 * Un mismo producto se vende a 1, 6 o 12 meses: cada plazo es su propio plan (su
 * precio y su suscripción), y la familia dice qué desbloquea.
 */
export type MembershipPlanFamily =
  | "guest_pass"
  | "guest_membership"
  | "host_verification"
  | "booking_engine"
  | "cleaning_tool"
  | "collaborator_seat"
  | "address_proof"
  | "featured_listing";

export const MEMBERSHIP_PLAN_FAMILY: Record<MembershipPlanCode, MembershipPlanFamily> = {
  pase_reserva: "guest_pass",
  meses_1: "guest_membership",
  meses_6: "guest_membership",
  meses_12: "guest_membership",
  anfitrion_1: "host_verification",
  anfitrion_6: "host_verification",
  anfitrion_12: "host_verification",
  booking_engine: "booking_engine",
  booking_engine_6: "booking_engine",
  booking_engine_12: "booking_engine",
  cleaning_tool: "cleaning_tool",
  cleaning_tool_6: "cleaning_tool",
  cleaning_tool_12: "cleaning_tool",
  collaborator_seat: "collaborator_seat",
  collaborator_seat_6: "collaborator_seat",
  collaborator_seat_12: "collaborator_seat",
  address_proof: "address_proof",
  address_proof_6: "address_proof",
  address_proof_12: "address_proof",
  featured_listing: "featured_listing",
  featured_listing_6: "featured_listing",
  featured_listing_12: "featured_listing",
};

export function planFamily(code: string): MembershipPlanFamily | undefined {
  return MEMBERSHIP_PLAN_FAMILY[code as MembershipPlanCode];
}

/** Familias que se cobran por unidad: el precio es por anuncio o por colaborador. */
export const MEMBERSHIP_FAMILY_UNIT: Partial<Record<MembershipPlanFamily, "listing" | "seat">> = {
  booking_engine: "listing",
  cleaning_tool: "listing",
  collaborator_seat: "seat",
  address_proof: "listing",
  featured_listing: "listing",
};

export const MEMBERSHIP_PLAN_UNIT: Partial<Record<MembershipPlanCode, "listing" | "seat">> = Object.fromEntries(
  MEMBERSHIP_PLAN_CODES.filter((c) => MEMBERSHIP_FAMILY_UNIT[MEMBERSHIP_PLAN_FAMILY[c]]).map((c) => [
    c,
    MEMBERSHIP_FAMILY_UNIT[MEMBERSHIP_PLAN_FAMILY[c]],
  ])
);

export const MEMBERSHIP_PLAN_MAX_QUANTITY = 200;

/** A quién le vende cada plan. Determina qué desbloquea el pago. */
export type MembershipAudience = "guest" | "host";

export const MEMBERSHIP_PLAN_AUDIENCE: Record<MembershipPlanCode, MembershipAudience> = Object.fromEntries(
  MEMBERSHIP_PLAN_CODES.map((c) => [c, MEMBERSHIP_PLAN_FAMILY[c].startsWith("guest_") ? "guest" : "host"])
) as Record<MembershipPlanCode, MembershipAudience>;

/**
 * Cómo se cobra cada plan. No es editable porque no es precio: cambiarlo
 * convertiría una suscripción en un pago único y al revés, y las suscripciones
 * que ya existen seguirían cobrando con la forma vieja.
 */
export type MembershipPlanBilling =
  | { kind: "one_time" }
  | { kind: "subscription"; intervalCount: number };

export const MEMBERSHIP_PLAN_BILLING: Record<MembershipPlanCode, MembershipPlanBilling> = Object.fromEntries(
  MEMBERSHIP_PLAN_CODES.map((c) => {
    if (c === "pase_reserva") return [c, { kind: "one_time" }];
    const m = /_(6|12)$/.exec(c);
    return [c, { kind: "subscription", intervalCount: m ? Number(m[1]) : 1 }];
  })
) as Record<MembershipPlanCode, MembershipPlanBilling>;

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
  /** Última vez que el caché se alineó con el catálogo de urbnbeeai. */
  catalogSyncedAt?: string;
  /** Primera subida de precios locales a urbnbeeai. */
  catalogPushedAt?: string;
  /** Se aplicaron los precios iniciales que fijó el dueño (sólo a planes en 0). */
  defaultPricesAppliedAt?: string;
  /** La verificación de identidad quedó como un solo producto por persona. */
  identityMergedAt?: string;
};
