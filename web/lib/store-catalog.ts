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
import { hostEntitlementInTrial } from "@/lib/host-entitlement-types";
import { trialEligible, trialMaxQuantity } from "@/lib/store-trial";
import { trialDays } from "@/lib/trial-settings-store";
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
    "Te identificas con una identificación oficial y una selfie, y se comprueban contra bases de datos oficiales.",
    "Como huésped: reservas ilimitadas mientras esté activa.",
    "Como anfitrión: listón «Miembro verificado» en todos tus anuncios. Es obligatoria para usar el motor de reservas.",
    "En el chat puedes mandar fotos y notas de voz (con su transcripción).",
    "Traductor automático del chat: lo que te escriben se traduce al idioma que elijas en tu perfil y, antes de enviar, puedes traducir lo que escribes al idioma de la otra persona.",
    "Mientras la pagues, cada mes volvemos a revisar tu identificación contra datos oficiales. Si dejas de pagar, se deja de verificar y se quita el listón. Si la revisión pide confirmarla de nuevo, te pediremos que vuelvas a subir tu identificación y selfie.",
    "Reseñas de ida y vuelta: cuando reservas con el motor de reservas de Cabibee, tú calificas al anfitrión y él te califica a ti. Tu comentario pasa por revisión del equipo Cabibee.",
    "Entre más largo el plazo, más barato por mes.",
  ],
  host_verification: [
    "Te identificas con una identificación oficial y una selfie, y se comprueban contra bases de datos oficiales.",
    "Listón «Miembro verificado» en todos tus anuncios.",
    "En el chat puedes mandar fotos y notas de voz (con su transcripción).",
    "Traductor automático del chat: lo que te escriben se traduce al idioma que elijas en tu perfil y, antes de enviar, puedes traducir lo que escribes al idioma del huésped.",
    "Reseñas de ida y vuelta: en las reservas hechas con el motor de reservas de Cabibee, tú calificas al huésped y él te califica a ti. Tu comentario pasa por revisión del equipo Cabibee.",
    "Tus anuncios se destacan frente a los no verificados.",
    "Es obligatoria para usar el motor de reservas.",
    "Mientras la pagues, cada mes volvemos a revisar tu identificación contra datos oficiales. Si dejas de pagar, se deja de verificar y se quita el listón. Si la revisión pide confirmarla de nuevo, te pediremos que vuelvas a subir tu identificación y selfie.",
    "Entre más largo el plazo, más barato por mes.",
  ],
  booking_engine: [
    "Se paga por anuncio: eliges qué anuncios lo usan.",
    "El huésped tiene que identificarse (identificación oficial y selfie) antes de reservar.",
    "El huésped paga con cualquier tarjeta de crédito o débito (Visa, Mastercard, American Express, Discover, JCB y UnionPay), Apple Pay o Google Pay.",
    "El dinero cae directo a tu propia cuenta, sin intermediarios y al momento, y la reserva se confirma sola al pagar.",
    "Contrato entre tú y tu huésped, firmado en línea y adaptado a la ley de tu estado y ciudad.",
    "Requiere tu verificación de identidad (se contrata aparte): así el huésped reserva seguro.",
    "Incluye la verificación de dirección de cada anuncio: subes un recibo a tu nombre con la dirección del anuncio y lo revisamos. Con ella tu anuncio muestra el listón «Ubicación verificada», que le da más seguridad y confianza a quien reserva. Sin ella sí recibes reservas, sólo no aparece el listón.",
    "Bloqueo automático de fechas y calendario.",
    "Recordatorios por correo a ti y a tu huésped antes de la llegada, y para dejarse reseña al terminar.",
  ],
  cleaning_tool: [
    "Se paga por anuncio: los anuncios pagados entran a tu herramienta de limpieza.",
    "Cada reserva crea su limpieza para el día de salida, sin que hagas nada.",
    "Asignación automática a quien limpia ese anuncio, o manual si prefieres.",
    "Puedes pedir foto al terminar; quien limpia deja notas y te escribe por el chat.",
    "Insumos: anota lo que usas (papel de baño, jabones, lo que quieras), cuántos hay y un mínimo. Al llegar al mínimo se le avisa a quien tú elijas para que compre.",
    "Próximamente incluido: entrada y salida con ubicación. Quien limpia marca su llegada y salida desde el lugar, y ves el historial de cada persona por día.",
  ],
  collaborator_seat: [
    "Se paga por colaborador.",
    "La persona entra con su propia cuenta de Cabibee; tú la invitas por correo.",
    "Tú eliges sus roles: aceptar y verificar reservas, firmar contratos en tu nombre, contestar mensajes de tus huéspedes.",
    "Puede ser parte de tu equipo de limpieza: recibe sus limpiezas, manda fotos de que ya quedó limpio y deja notas.",
    "Chats de equipo incluidos: crea los chats que quieras con tu gente (cuentas, limpiezas, insumos…) y guarda ahí fotos, audios y archivos.",
    "Tú eliges a qué anuncios tiene acceso.",
    "Le quitas el acceso cuando quieras desde tu panel de colaboradores.",
  ],
  address_proof: [
    "Se paga por anuncio: cubre los anuncios que no tienen motor de reservas.",
    "Subes un recibo a tu nombre (luz, agua, internet, predial o renta) con la dirección del anuncio y lo revisamos.",
    "Tu anuncio muestra el listón «Ubicación verificada»: le dice a quien reserva que el lugar existe, que está donde dice el anuncio y que lo renta quien dice. Es tu mejor defensa contra anuncios falsos.",
    "El motor de reservas ya la trae incluida en su precio. Si vas a comprar el motor para ese anuncio, no compres esta: el motor se cobra completo aunque ya la tengas.",
    "Mientras la pagues, cada mes volvemos a revisar la dirección contra datos oficiales. Si dejas de pagar, se quita el listón. Si la revisión pide confirmarla de nuevo, te pediremos otro comprobante.",
  ],
  featured_listing: [
    "Se paga por anuncio: eliges qué anuncios se destacan.",
    "Tu anuncio aparece antes que los demás en las búsquedas de la web y la app.",
    "Lleva la etiqueta «Destacado».",
    "Cambias de anuncio cuando quieras desde Mis herramientas.",
    "El precio sube o baja según cuántos anfitriones lo quieren ahorita; lugares limitados.",
    "Si ya lo tienes, tu renovación conserva el precio con que lo compraste.",
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
    /** En prueba gratis hasta esta fecha; ese día se cobra el plan por primera vez. */
    trialEndsAt?: string;
  };
  /** Puede empezar la prueba gratis (sólo una por herramienta). */
  trial?: { days: number; maxQuantity?: number };
  /** Aviso que va arriba del precio (por ejemplo: «el motor ya la incluye»). */
  notice?: string;
};

/** Avisos fijos por producto. */
const NOTICE: Partial<Record<MembershipPlanFamily, string>> = {
  address_proof:
    "El motor de reservas ya trae la verificación de dirección en su precio. Si vas a comprar el motor de reservas para ese anuncio, no compres esta.",
};

const FAMILY_ORDER: MembershipPlanFamily[] = [
  "booking_engine",
  "cleaning_tool",
  "collaborator_seat",
  "address_proof",
  "featured_listing",
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
      ...(hostEntitlementInTrial(row) ? { trialEndsAt: row.trialEndsAt } : {}),
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
      ...(trialEligible(user, p.code)
        ? { trial: { days: trialDays(), ...(trialMaxQuantity(p.code) ? { maxQuantity: trialMaxQuantity(p.code) } : {}) } }
        : {}),
      ...(NOTICE[family] ? { notice: NOTICE[family] } : {}),
    });
  }
  for (const item of byFamily.values()) item.terms.sort((a, b) => a.months - b.months);
  return FAMILY_ORDER.filter((f) => byFamily.has(f)).map((f) => byFamily.get(f)!);
}
