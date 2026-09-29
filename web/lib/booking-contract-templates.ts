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

const FACILITATOR =
  "Cabibee facilita la reserva, el pago y este registro. Las obligaciones de hospedaje son entre anfitrión y huésped. Cabibee no es parte del contrato de hospedaje.";

const DEPOSIT_NOTE =
  "Si hay depósito, se pacta y se entrega entre anfitrión y huésped. Cabibee no retiene ni custodia ese dinero.";

export const BOOKING_CONTRACT_TEMPLATES: BookingContractTemplate[] = [
  {
    id: "cabibee_reserva_v1",
    title: "Reserva estándar",
    blurb: "Estancias cortas. Fechas, montos, reglas de casa y cancelación simple.",
    defaultCancellation:
      "Las cancelaciones se rigen por lo que acuerden las partes. Un rechazo del anfitrión después del pago devuelve el total cobrado, incluido el cargo de servicio.",
    defaultExtraClauses: "",
    depositHint: "Opcional. Si lo dejas en 0, el contrato dice que no hay depósito declarado.",
  },
  {
    id: "cabibee_estancia_media_v1",
    title: "Estancia media",
    blurb: "Semanas o un mes. Más énfasis en uso de la vivienda y salida en orden.",
    defaultCancellation:
      "Si el huésped cancela con 7 días o más de anticipación, las partes acuerdan la devolución salvo gastos ya erogados. Con menos de 7 días, el anfitrión puede retener hasta el equivalente de una noche. Un rechazo del anfitrión después del pago devuelve el total cobrado, incluido el cargo de servicio.",
    defaultExtraClauses:
      "El huésped usará el inmueble solo para hospedaje. Al salir dejará las llaves y el espacio en el estado en que lo recibió, salvo desgaste normal.",
    depositHint: "Recomendado si hay amenidades de valor. Cabibee no lo retiene.",
  },
  {
    id: "cabibee_con_deposito_v1",
    title: "Reserva con depósito",
    blurb: "Igual que el estándar, más un depósito que pactas tú. Cabibee no lo guarda.",
    defaultCancellation:
      "Las cancelaciones se rigen por lo que acuerden las partes. El depósito, si se entregó, se trata entre anfitrión y huésped. Un rechazo del anfitrión después del pago devuelve el total cobrado en Cabibee, incluido el cargo de servicio.",
    defaultExtraClauses:
      "El depósito se entrega y se devuelve entre las partes, fuera de Cabibee. El anfitrión documentará cualquier descuento por daños.",
    depositHint: "Declara el monto. El dinero no pasa por Cabibee.",
  },
];

export function isContractTemplateId(v: string): v is BookingContractTemplateId {
  return (BOOKING_CONTRACT_TEMPLATE_IDS as readonly string[]).includes(v);
}

export function getContractTemplate(id: string | undefined): BookingContractTemplate {
  return BOOKING_CONTRACT_TEMPLATES.find((t) => t.id === id) ?? BOOKING_CONTRACT_TEMPLATES[0];
}

export function contractFacilitatorNote(): string {
  return FACILITATOR;
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
  });
}
