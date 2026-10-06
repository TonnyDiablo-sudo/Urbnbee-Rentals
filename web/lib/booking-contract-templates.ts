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
  /**
   * Texto que el anfitrión puso en lugar del de cada cláusula (clave = título de la cláusula).
   * Cadena vacía = la cláusula se quita del contrato. La cláusula de la herramienta no se edita.
   */
  clauseOverrides: Record<string, string>;
  /**
   * Secciones del contrato tal como las dejó el anfitrión: orden, renombres, textos propios y secciones nuevas.
   * Si falta, se usa el texto de fábrica (o `clauseOverrides`, el formato anterior).
   */
  clauseLayout?: ContractClauseEdit[];
  /** Sustituye el apartado de ley aplicable y tribunales. */
  governingLawOverride?: string;
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
    clauseOverrides: cleanClauseOverrides(partial?.clauseOverrides),
    clauseLayout: cleanClauseLayout(partial?.clauseLayout),
    governingLawOverride: partial?.governingLawOverride?.trim() || undefined,
    hostAcknowledged: Boolean(partial?.hostAcknowledged),
    hostReviewed: Boolean(partial?.hostReviewed),
    hostReviewedAt: partial?.hostReviewed ? partial.hostReviewedAt || undefined : undefined,
  };
}

const MAX_CLAUSE_OVERRIDES = 40;
const MAX_CLAUSE_CHARS = 6000;

function cleanClauseOverrides(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const title = k.trim().slice(0, 120);
    if (!title || typeof v !== "string") continue;
    out[title] = v.trim().slice(0, MAX_CLAUSE_CHARS);
    if (Object.keys(out).length >= MAX_CLAUSE_OVERRIDES) break;
  }
  return out;
}

/** Una sección del contrato como la ve el anfitrión en el editor. */
export type ContractClauseEdit = {
  /** Título de la cláusula de fábrica que representa; si falta, es una sección nueva del anfitrión. */
  base?: string;
  title: string;
  /** Texto propio; si falta (y hay `base`) se usa el de fábrica, que puede llevar datos del anuncio. */
  text?: string;
};

/** Cláusula de fábrica tal como la recibe el editor. */
export type EditableContractClause = { title: string; text: string; locked: boolean };

export function cleanClauseLayout(raw: unknown): ContractClauseEdit[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ContractClauseEdit[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const base = typeof o.base === "string" ? o.base.trim().slice(0, 120) : "";
    const title = typeof o.title === "string" ? o.title.trim().slice(0, 120) : "";
    const text = typeof o.text === "string" ? o.text.trim().slice(0, MAX_CLAUSE_CHARS) : undefined;
    if (!title && !base) continue;
    out.push({ ...(base ? { base } : {}), title: title || base, ...(text !== undefined ? { text } : {}) });
    if (out.length >= MAX_CLAUSE_OVERRIDES) break;
  }
  return out;
}

/** Las secciones de fábrica, sin cambios, en forma de layout. */
export function defaultClauseLayout(clauses: EditableContractClause[]): ContractClauseEdit[] {
  return clauses.map((c) => ({ base: c.title, title: c.title }));
}

/** Convierte el formato anterior (texto por título, vacío = quitada) al layout. */
export function layoutFromClauseOverrides(clauses: EditableContractClause[], overrides: Record<string, string>): ContractClauseEdit[] {
  return clauses.flatMap((c) => {
    const o = c.locked ? undefined : overrides[c.title];
    if (o === undefined) return [{ base: c.title, title: c.title }];
    if (!o.trim()) return [];
    return [{ base: c.title, title: c.title, text: o.trim() }];
  });
}

/** Secciones finales del contrato a partir del layout. La cláusula bloqueada siempre va, con su texto. */
export function applyClauseLayout(clauses: EditableContractClause[], layout: ContractClauseEdit[]): { title: string; text: string }[] {
  const out: { title: string; text: string }[] = [];
  const lockedSeen = new Set<string>();
  for (const e of layout) {
    const b = e.base ? clauses.find((c) => c.title === e.base) : undefined;
    if (b?.locked) {
      if (!lockedSeen.has(b.title)) {
        lockedSeen.add(b.title);
        out.push({ title: b.title, text: b.text });
      }
      continue;
    }
    const title = e.title.trim() || b?.title || "";
    const text = (e.text ?? b?.text ?? "").trim();
    if (!title || !text) continue;
    out.push({ title, text });
  }
  for (const c of clauses) if (c.locked && !lockedSeen.has(c.title)) out.push({ title: c.title, text: c.text });
  return out;
}

/** `undefined` si el layout es igual al de fábrica (así no se guarda nada de más). */
export function normalizeClauseLayout(layout: ContractClauseEdit[], clauses: EditableContractClause[]): ContractClauseEdit[] | undefined {
  const cleaned = layout.map((e) => {
    const b = e.base ? clauses.find((c) => c.title === e.base) : undefined;
    if (b?.locked) return { base: b.title, title: b.title };
    const title = e.title.trim();
    const text = e.text?.trim();
    const sameText = b && (text === undefined || text === b.text.trim());
    return {
      ...(b ? { base: b.title } : {}),
      title: title || b?.title || "",
      ...(sameText || text === undefined ? {} : { text }),
    };
  });
  const same =
    cleaned.length === clauses.length &&
    cleaned.every((e, i) => e.base === clauses[i].title && e.title === clauses[i].title && e.text === undefined);
  return same ? undefined : cleaned;
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
    clauseOverrides: o.clauseOverrides !== undefined ? cleanClauseOverrides(o.clauseOverrides) : prev.clauseOverrides,
    // `null` = volver al texto de fábrica.
    clauseLayout: o.clauseLayout !== undefined ? cleanClauseLayout(o.clauseLayout) : prev.clauseLayout,
    governingLawOverride:
      o.governingLawOverride !== undefined ? String(o.governingLawOverride).slice(0, 2000) : prev.governingLawOverride,
    hostAcknowledged: o.hostAcknowledged !== undefined ? Boolean(o.hostAcknowledged) : prev.hostAcknowledged,
    hostReviewed: reviewed,
    hostReviewedAt: reviewed
      ? (prev.hostReviewed && prev.hostReviewedAt) ||
        (typeof o.hostReviewedAt === "string" && !Number.isNaN(Date.parse(o.hostReviewedAt)) ? o.hostReviewedAt : "") ||
        new Date().toISOString()
      : undefined,
  });
}
