export const BOOKING_CONTRACT_TEMPLATE_IDS = [
  "cabibee_reserva_v1",
  "cabibee_estancia_media_v1",
  "cabibee_con_deposito_v1",
] as const;

export type BookingContractTemplateId = (typeof BOOKING_CONTRACT_TEMPLATE_IDS)[number];

export type BookingContractTemplate = {
  id: BookingContractTemplateId;
  title: string;
  blurb: string;
  defaultCancellation: string;
  defaultExtraClauses: string;
  depositHint: string;
};

/** Sólo para contratos generados antes de las plantillas entre particulares. */
const LEGACY_FACILITATOR =
  "Cabibee facilita la reserva, el pago y este registro. Las obligaciones de hospedaje son entre anfitrión y huésped. Cabibee no es parte del contrato de hospedaje.";

const DEPOSIT_NOTE =
  "El depósito, si se pacta, lo entrega el huésped directamente al anfitrión y se devuelve al terminar la estancia, descontando sólo los daños que el anfitrión documente con fotos o comprobantes.";

export const BOOKING_CONTRACT_TEMPLATES: BookingContractTemplate[] = [
  {
    id: "cabibee_reserva_v1",
    title: "Hospedaje estándar",
    blurb: "Estancias cortas. Fechas, montos, reglas de casa, cancelación simple y la ley del lugar.",
    defaultCancellation:
      "Si el huésped cancela con 5 días o más de anticipación a la entrada, el anfitrión devuelve el total de la estancia. Con menos de 5 días, el anfitrión puede retener hasta el equivalente de una noche. Si el anfitrión cancela o rechaza la reserva después del pago, devuelve el total cobrado.",
    defaultExtraClauses: "",
    depositHint: "Opcional. Si lo dejas en 0, el contrato dice que no hay depósito.",
  },
  {
    id: "cabibee_estancia_media_v1",
    title: "Estancia media",
    blurb: "Semanas o meses. Más detalle sobre uso de la vivienda, servicios y salida en orden.",
    defaultCancellation:
      "Si el huésped cancela con 14 días o más de anticipación, el anfitrión devuelve el total de la estancia salvo gastos ya erogados y comprobables. Con menos de 14 días, el anfitrión puede retener hasta el equivalente de siete noches. Una vez iniciada la estancia, si el huésped se va antes, las noches no usadas se devuelven sólo si el anfitrión logra ocupar esas fechas. Si el anfitrión cancela, devuelve el total cobrado.",
    defaultExtraClauses:
      "El huésped usará el inmueble sólo para hospedaje y lo mantendrá limpio durante la estancia. Los consumos de luz, agua y gas que excedan un uso razonable podrán cobrarse con el recibo correspondiente. Al salir entregará las llaves y el espacio en el estado en que lo recibió, salvo el desgaste normal.",
    depositHint: "Recomendado si hay amenidades de valor o estancias de varias semanas.",
  },
  {
    id: "cabibee_con_deposito_v1",
    title: "Hospedaje con depósito",
    blurb: "Igual que el estándar, más un depósito en garantía que pactas directo con el huésped.",
    defaultCancellation:
      "Si el huésped cancela con 5 días o más de anticipación a la entrada, el anfitrión devuelve el total de la estancia y el depósito. Con menos de 5 días, el anfitrión puede retener hasta el equivalente de una noche. Si el anfitrión cancela o rechaza la reserva después del pago, devuelve el total cobrado y el depósito.",
    defaultExtraClauses:
      "El anfitrión devolverá el depósito dentro de los 7 días siguientes a la salida. Si descuenta algún daño, enviará al huésped fotos y el costo de la reparación o reposición.",
    depositHint: "Declara el monto. Se entrega y se devuelve directo entre tú y el huésped.",
  },
];

export function isContractTemplateId(v: string): v is BookingContractTemplateId {
  return (BOOKING_CONTRACT_TEMPLATE_IDS as readonly string[]).includes(v);
}

export function getContractTemplate(id: string | undefined): BookingContractTemplate {
  return BOOKING_CONTRACT_TEMPLATES.find((t) => t.id === id) ?? BOOKING_CONTRACT_TEMPLATES[0];
}

export function legacyFacilitatorNote(): string {
  return LEGACY_FACILITATOR;
}

export function contractDepositNote(): string {
  return DEPOSIT_NOTE;
}

export type ListingContractSettings = {
  templateId: BookingContractTemplateId;
  /** Nombre con el que el anfitrión firma y aparece en el contrato. */
  hostLegalName: string;
  hostAddress: string;
  propertyAddress: string;
  depositMxn: number;
  extraClauses: string;
  cancellationOverride?: string;
  /** El anfitrión confirmó esta plantilla en el anuncio (firma de oferta para reservas instantáneas). */
  hostAcknowledged: boolean;
  /** El anfitrión confirmó que leyó el contrato completo y que se ajusta a su caso. */
  hostReviewed: boolean;
  /** Cuándo aceptó que el contrato es entre él y sus huéspedes y que es responsable de él. */
  hostReviewedAt?: string;
};

export function defaultListingContract(partial?: Partial<ListingContractSettings>): ListingContractSettings {
  const template = getContractTemplate(partial?.templateId);
  return {
    templateId: template.id,
    hostLegalName: (partial?.hostLegalName ?? "").trim(),
    hostAddress: (partial?.hostAddress ?? "").trim(),
    propertyAddress: (partial?.propertyAddress ?? "").trim(),
    depositMxn: Math.max(0, Math.round(Number(partial?.depositMxn) || 0)),
    extraClauses: (partial?.extraClauses ?? template.defaultExtraClauses).trim(),
    cancellationOverride: partial?.cancellationOverride?.trim() || undefined,
    hostAcknowledged: Boolean(partial?.hostAcknowledged),
    hostReviewed: Boolean(partial?.hostReviewed),
    hostReviewedAt: partial?.hostReviewed ? partial.hostReviewedAt || undefined : undefined,
  };
}

export function sanitizeListingContract(raw: unknown, fallback?: ListingContractSettings): ListingContractSettings {
  const prev = fallback ?? defaultListingContract();
  if (!raw || typeof raw !== "object") return prev;
  const o = raw as Record<string, unknown>;
  const templateId = typeof o.templateId === "string" && isContractTemplateId(o.templateId) ? o.templateId : prev.templateId;
  const template = getContractTemplate(templateId);
  const extra =
    o.extraClauses !== undefined
      ? String(o.extraClauses).trim().slice(0, 4000)
      : prev.extraClauses || template.defaultExtraClauses;
  const reviewed = o.hostReviewed !== undefined ? Boolean(o.hostReviewed) : prev.hostReviewed;
  return defaultListingContract({
    templateId,
    hostLegalName: o.hostLegalName !== undefined ? String(o.hostLegalName).slice(0, 160) : prev.hostLegalName,
    hostAddress: o.hostAddress !== undefined ? String(o.hostAddress).slice(0, 240) : prev.hostAddress,
    propertyAddress: o.propertyAddress !== undefined ? String(o.propertyAddress).slice(0, 240) : prev.propertyAddress,
    depositMxn: o.depositMxn !== undefined ? Number(o.depositMxn) : prev.depositMxn,
    extraClauses: extra,
    cancellationOverride:
      o.cancellationOverride !== undefined ? String(o.cancellationOverride).slice(0, 2000) : prev.cancellationOverride,
    hostAcknowledged: o.hostAcknowledged !== undefined ? Boolean(o.hostAcknowledged) : prev.hostAcknowledged,
    hostReviewed: reviewed,
    hostReviewedAt: reviewed
      ? (prev.hostReviewed && prev.hostReviewedAt) ||
        (typeof o.hostReviewedAt === "string" && !Number.isNaN(Date.parse(o.hostReviewedAt)) ? o.hostReviewedAt : "") ||
        new Date().toISOString()
      : undefined,
  });
}
