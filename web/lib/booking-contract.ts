import "server-only";
import { createHash } from "crypto";
import {
  contractDepositNote,
  defaultListingContract,
  getContractTemplate,
  type ListingContractSettings,
} from "@/lib/booking-contract-templates";
import {
  commonContractClauses,
  contractJurisdiction,
  SEVERABILITY_CLAUSE,
  THIRD_PARTY_CLAUSE,
} from "@/lib/contract-jurisdiction";
import type {
  BookingContractActor,
  BookingContractEvent,
  BookingContractRecord,
  BookingContractSnapshot,
} from "@/lib/booking-contract-types";
import { enqueueBookingOutbound } from "@/lib/beeagent-outbound";
import type { BookingRecord } from "@/lib/booking-types";
import { attachDepositIfNeeded } from "@/lib/booking-deposit";
import { confirmBookingAfterGuestContract } from "@/lib/booking-machine";
import { getBookingById, patchBookingRecord } from "@/lib/bookings-store";
import { findUserById, getHostProfile, getListingById } from "@/lib/marketplace-store";
import { platformBookingFeeMxn } from "@/lib/platform-fees";
import { computeStayTax } from "@/lib/stay-tax";

function nowIso() {
  return new Date().toISOString();
}

function ruleLabel(v: boolean | null | undefined): string {
  if (v === true) return "permitido";
  if (v === false) return "no permitido";
  return "no especificado";
}

function event(
  actor: BookingContractActor,
  action: string,
  detail?: string,
  ip?: string,
  userAgent?: string
): BookingContractEvent {
  return { at: nowIso(), actor, action, detail, ip, userAgent };
}

export function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function given(v: string | undefined): string {
  const t = (v ?? "").trim();
  return t && t !== "—" ? t : "no proporcionado";
}

function cleanName(v: string | undefined, fallback: string): string {
  const t = (v ?? "").trim();
  return t || fallback;
}

export function buildContractSnapshot(
  booking: BookingRecord,
  settingsOverride?: ListingContractSettings
): BookingContractSnapshot | null {
  const listingId = booking.hostAdjustedListingId ?? booking.listingId;
  const listing = getListingById(listingId);
  if (!listing) return null;

  const host = findUserById(booking.hostId);
  const hostProfile = getHostProfile(booking.hostId);
  const guest = booking.guestUserId ? findUserById(booking.guestUserId) : undefined;
  const settings = settingsOverride ?? defaultListingContract(listing.contract);
  const template = getContractTemplate(settings.templateId);

  const checkIn = booking.hostAdjustedCheckIn ?? booking.checkIn;
  const checkOut = booking.hostAdjustedCheckOut ?? booking.checkOut;
  // Si cambió el total después de pagar, el cargo de plataforma se recalcula igual que el cobro o
  // la devolución de la diferencia.
  const paidStay = booking.paidAt ? (booking.paidStayMxn ?? booking.estimatedTotalMxn) : booking.estimatedTotalMxn;
  const fee =
    booking.chargedVia !== "host" && (booking.platformFeeMxn ?? 0) > 0 && paidStay !== booking.estimatedTotalMxn
      ? platformBookingFeeMxn(booking.estimatedTotalMxn)
      : (booking.platformFeeMxn ?? platformBookingFeeMxn(booking.estimatedTotalMxn));
  const taxMxn = booking.taxMxn ?? 0;
  const taxAdded = booking.taxIncluded ? 0 : taxMxn;
  const propertyAddress =
    settings.propertyAddress ||
    [listing.addressLine, listing.zone, listing.county, listing.city, listing.state, listing.country]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(", ") ||
    `${listing.city || "—"}, ${listing.zone || "—"}`;
  const maxGuests = Math.max(1, listing.guests || 1);
  const place = contractJurisdiction(
    { country: listing.country, state: listing.state, city: listing.city, municipality: listing.county },
    { nights: booking.nights }
  );

  return {
    format: 2,
    listingState: listing.state || undefined,
    listingCountry: listing.country || undefined,
    maxGuests,
    jurisdiction: {
      label: place.label,
      governingLaw: place.governingLaw,
      courts: place.courts,
      clauses: [...commonContractClauses(maxGuests), ...place.localClauses, THIRD_PARTY_CLAUSE, SEVERABILITY_CLAUSE],
    },
    templateId: template.id,
    templateTitle: template.title,
    listingId: listing.id,
    listingTitle: listing.title,
    listingCity: listing.city || "—",
    listingZone: listing.zone || "—",
    propertyAddress,
    hostId: booking.hostId,
    hostLegalName: cleanName(settings.hostLegalName, host?.fullName?.trim() || "Anfitrión"),
    hostAddress: settings.hostAddress || host?.addressLine || listing.addressLine || "—",
    hostEmail: hostProfile?.email || host?.email || "",
    hostPhone: hostProfile?.phone || host?.phone || "",
    guestName: cleanName(guest?.fullName, booking.guestName),
    guestEmail: guest?.email || booking.guestEmail,
    guestPhone:
      guest?.phone || booking.guestPhone || (booking.guestUserId ? getHostProfile(booking.guestUserId)?.phone : "") || "",
    guestAddress: guest?.addressLine || "",
    checkIn,
    checkOut,
    nights: booking.nights,
    stayMxn: Math.max(0, booking.estimatedTotalMxn - taxAdded - (listing.cleaningFee ?? 0)),
    cleaningMxn: listing.cleaningFee ?? booking.cleaningFeeMxn ?? 0,
    platformFeeMxn: fee,
    totalMxn: booking.estimatedTotalMxn + fee,
    ...(taxMxn > 0
      ? {
          taxMxn,
          taxLines: booking.taxLines,
          taxIncluded: Boolean(booking.taxIncluded),
          hostTaxId: hostProfile?.tax?.taxId,
        }
      : {}),
    depositMxn: settings.depositMxn,
    depositNote: contractDepositNote(),
    extraClauses: settings.extraClauses || template.defaultExtraClauses,
    rules: {
      smoking: listing.rules.smoking ?? null,
      pets: listing.rules.pets ?? null,
      parties: listing.rules.parties ?? null,
      children: listing.rules.children ?? null,
    },
    cancellationPolicy: settings.cancellationOverride || template.defaultCancellation,
    facilitatorNote: THIRD_PARTY_CLAUSE.text,
  };
}

function hostSignsOnGenerate(
  actor: { role: BookingContractActor; signName?: string },
  snapshot: BookingContractSnapshot,
  listingAcknowledged: boolean
): boolean {
  if (actor.role === "host" && actor.signName?.trim()) return true;
  if (actor.role === "system" && listingAcknowledged) return true;
  return false;
}

/**
 * Crea el contrato si no existe (al solicitar la reserva).
 * Si ya existe y el anfitrión acepta sin haber firmado, lo firma aquí.
 */
export function ensureBookingContract(
  bookingId: string,
  actor: { role: BookingContractActor; userId?: string; ip?: string; signName?: string; signedBy?: string }
): BookingRecord | undefined {
  const booking = getBookingById(bookingId);
  if (!booking) return undefined;
  if (booking.contract) {
    if (actor.role === "host" && actor.signName && !booking.contract.hostAcceptedAt) {
      return hostSignBookingContract(bookingId, {
        name: actor.signName,
        userId: actor.userId,
        ip: actor.ip,
        signedBy: actor.signedBy,
      }) ?? booking;
    }
    return booking;
  }

  const snapshot = buildContractSnapshot(booking);
  if (!snapshot) return undefined;

  const listing = getListingById(booking.hostAdjustedListingId ?? booking.listingId);
  const settings = defaultListingContract(listing?.contract);
  const generatedAt = nowIso();
  const hostSigns = hostSignsOnGenerate(actor, snapshot, settings.hostAcknowledged);
  const hostName = actor.signName?.trim() || snapshot.hostLegalName;

  const contract: BookingContractRecord = {
    version: 1,
    templateId: snapshot.templateId,
    generatedAt,
    snapshot,
    hostAcceptedAt: hostSigns ? generatedAt : undefined,
    hostAcceptedByUserId: actor.userId,
    hostAcceptedName: hostSigns ? hostName.slice(0, 160) : undefined,
    hostAcceptedIp: hostSigns ? actor.ip : undefined,
    events: [
      event(
        actor.role,
        "generated",
        actor.role === "system"
          ? booking.status === "AWAITING_PAYMENT"
            ? "Se generó el contrato al solicitar la reserva."
            : "Reserva instantánea: se usó la plantilla que el anfitrión configuró en el anuncio."
          : "El anfitrión aceptó la solicitud y se generó el contrato.",
        actor.ip
      ),
      ...(hostSigns
        ? [
            event(
              actor.role === "system" ? "host" : actor.role,
              "signed",
              hostSignedText(hostName, actor.signedBy),
              actor.ip
            ),
          ]
        : []),
    ],
  };

  const saved = patchBookingRecord(bookingId, { contract, contractStatus: "pending" });
  return saved ? attachDepositIfNeeded(saved) : saved;
}

const MONEY_FIELDS = new Set<keyof BookingContractSnapshot>(["stayMxn", "cleaningMxn", "taxMxn", "totalMxn", "depositMxn"]);
const TERM_LABELS: [keyof BookingContractSnapshot, string][] = [
  ["listingId", "alojamiento"],
  ["checkIn", "entrada"],
  ["checkOut", "salida"],
  ["nights", "noches"],
  ["stayMxn", "monto de la estancia"],
  ["cleaningMxn", "limpieza"],
  ["taxMxn", "impuestos"],
  ["totalMxn", "total"],
  ["depositMxn", "depósito"],
];

/** Términos que cambian lo que las partes firmaron (no cuentan correcciones de nombre o teléfono). */
export function changedContractTerms(prev: BookingContractSnapshot, next: BookingContractSnapshot): string[] {
  const out: string[] = [];
  for (const [key, label] of TERM_LABELS) {
    const a = MONEY_FIELDS.has(key) ? Number(prev[key] ?? 0) : prev[key];
    const b = MONEY_FIELDS.has(key) ? Number(next[key] ?? 0) : next[key];
    if (a === b) continue;
    if (MONEY_FIELDS.has(key)) {
      out.push(`${label}: $${Number(a).toLocaleString("es-MX")} → $${Number(b).toLocaleString("es-MX")}`);
    } else if (key === "listingId") {
      out.push(`${label}: ${prev.listingTitle} → ${next.listingTitle}`);
    } else {
      out.push(`${label}: ${a} → ${b}`);
    }
  }
  return out;
}

/**
 * Deja el contrato alineado con la reserva. Si cambiaron fechas, alojamiento o montos,
 * se genera una versión nueva; la anterior (con sus firmas) queda archivada y el huésped
 * tiene que volver a firmar — nunca se le cambian los términos a una firma ya puesta.
 */
export function syncContractWithBooking(
  bookingId: string,
  actor: { role: BookingContractActor; userId?: string; ip?: string; signName?: string; signedBy?: string }
): BookingRecord | undefined {
  const booking = getBookingById(bookingId);
  if (!booking) return undefined;
  if (!booking.contract) return ensureBookingContract(bookingId, actor);

  const fresh = buildContractSnapshot(booking);
  if (!fresh) return booking;
  const prev = booking.contract;
  const changes = changedContractTerms(prev.snapshot, fresh);
  if (changes.length === 0) return ensureBookingContract(bookingId, actor);

  const at = nowIso();
  const signName = actor.signName?.trim().slice(0, 160) ?? "";
  const hostSigns = actor.role === "host" && signName.length >= 3;
  const guestHadSigned = Boolean(prev.guestAcceptedAt);
  const archived =
    prev.hostAcceptedAt || prev.guestAcceptedAt
      ? [
          ...(prev.previousVersions ?? []),
          {
            generatedAt: prev.generatedAt,
            supersededAt: at,
            snapshot: prev.snapshot,
            hostAcceptedAt: prev.hostAcceptedAt,
            hostAcceptedName: prev.hostAcceptedName,
            guestAcceptedAt: prev.guestAcceptedAt,
            guestAcceptedName: prev.guestAcceptedName,
            acceptedSha256: prev.acceptedSha256,
            changes,
          },
        ]
      : prev.previousVersions;

  const contract: BookingContractRecord = {
    version: 1,
    templateId: fresh.templateId,
    generatedAt: at,
    snapshot: fresh,
    previousVersions: archived,
    hostAcceptedAt: hostSigns ? at : undefined,
    hostAcceptedByUserId: hostSigns ? actor.userId : undefined,
    hostAcceptedName: hostSigns ? signName : undefined,
    hostAcceptedIp: hostSigns ? actor.ip : undefined,
    events: [
      ...prev.events,
      event(
        actor.role,
        "amended",
        `Se actualizó el contrato (${changes.join("; ")}).${
          guestHadSigned ? " La firma anterior del huésped quedó archivada y tiene que firmar la versión nueva." : ""
        }`,
        actor.ip
      ),
      ...(hostSigns ? [event("host", "signed", hostSignedText(signName, actor.signedBy), actor.ip)] : []),
    ],
  };
  return patchBookingRecord(bookingId, { contract, contractStatus: "pending" });
}

/** Texto del contrato como quedaría con otras fechas o alojamiento (vista previa, no guarda nada). */
export function previewContractLines(
  booking: BookingRecord,
  proposal: {
    checkIn?: string;
    checkOut?: string;
    listingId?: string;
    nights?: number;
    estimatedTotalMxn?: number;
  } & Partial<Pick<BookingRecord, "taxMxn" | "taxLines" | "taxIncluded">>
): { lines: string[]; changes: string[]; guestMustResign: boolean } | null {
  const draft: BookingRecord = {
    ...booking,
    ...("taxMxn" in proposal
      ? { taxMxn: proposal.taxMxn, taxLines: proposal.taxLines, taxIncluded: proposal.taxIncluded }
      : {}),
    hostAdjustedCheckIn: proposal.checkIn && proposal.checkIn !== booking.checkIn ? proposal.checkIn : undefined,
    hostAdjustedCheckOut: proposal.checkOut && proposal.checkOut !== booking.checkOut ? proposal.checkOut : undefined,
    hostAdjustedListingId: proposal.listingId && proposal.listingId !== booking.listingId ? proposal.listingId : undefined,
    nights: proposal.nights ?? booking.nights,
    estimatedTotalMxn: proposal.estimatedTotalMxn ?? booking.estimatedTotalMxn,
  };
  const snapshot = buildContractSnapshot(draft);
  if (!snapshot) return null;
  const changes = booking.contract ? changedContractTerms(booking.contract.snapshot, snapshot) : [];
  const record: BookingContractRecord =
    booking.contract && changes.length === 0
      ? booking.contract
      : {
          version: 1,
          templateId: snapshot.templateId,
          generatedAt: nowIso(),
          snapshot,
          previousVersions: booking.contract?.previousVersions,
          events: [],
        };
  return {
    lines: contractPlainLines(record),
    changes,
    guestMustResign: Boolean(booking.contract?.guestAcceptedAt && changes.length > 0),
  };
}

/** Cómo se vería el contrato de un anuncio con estos ajustes, con un huésped y fechas de ejemplo. */
export function sampleContractLines(listingId: string, settings: ListingContractSettings): string[] | null {
  const listing = getListingById(listingId);
  if (!listing) return null;
  const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const nights = 3;
  const subtotal = listing.pricePerNight * nights + (listing.cleaningFee ?? 0);
  const tax = computeStayTax(getHostProfile(listing.hostId)?.tax, subtotal);
  const total = subtotal + tax.addedMxn;
  const at = nowIso();
  const sample = {
    id: "preview",
    listingId,
    hostId: listing.hostId,
    guestName: "Nombre del huésped (ejemplo)",
    guestEmail: "correo del huésped",
    guestPhone: "teléfono del huésped",
    checkIn: day(14),
    checkOut: day(14 + nights),
    nights,
    estimatedTotalMxn: total,
    ...(tax.taxMxn > 0 ? { taxMxn: tax.taxMxn, taxLines: tax.lines, taxIncluded: tax.included } : {}),
    status: "PENDING",
    token: "000000",
    createdAt: at,
    updatedAt: at,
  } as BookingRecord;
  const snapshot = buildContractSnapshot(sample, settings);
  if (!snapshot) return null;
  return contractPlainLines({
    version: 1,
    templateId: snapshot.templateId,
    generatedAt: at,
    snapshot: { ...snapshot, guestAddress: "domicilio del huésped" },
    events: [],
  }).filter((l) => !l.startsWith("BITÁCORA"));
}

export function attachContractIfInstant(booking: BookingRecord): BookingRecord {
  if (booking.status !== "CONFIRMED" || booking.contract) return booking;
  return ensureBookingContract(booking.id, { role: "system", userId: booking.hostId }) ?? booking;
}

/** Quien colabora firma con el nombre del anfitrión; el registro dice quién lo hizo. */
function hostSignedText(name: string, signedBy?: string): string {
  return signedBy
    ? `${signedBy} firmó en nombre del anfitrión, como «${name}».`
    : `El anfitrión firmó como «${name}».`;
}

export function hostSignBookingContract(
  bookingId: string,
  opts: { name: string; userId?: string; ip?: string; signedBy?: string }
): BookingRecord | undefined {
  const booking = getBookingById(bookingId);
  if (!booking?.contract) return undefined;
  if (booking.contract.hostAcceptedAt) return booking;

  const name = opts.name.trim().slice(0, 160);
  if (name.length < 3) return undefined;

  const acceptedAt = nowIso();
  const contract: BookingContractRecord = {
    ...booking.contract,
    hostAcceptedAt: acceptedAt,
    hostAcceptedByUserId: opts.userId,
    hostAcceptedName: name,
    hostAcceptedIp: opts.ip,
    events: [
      ...booking.contract.events,
      event("host", "signed", hostSignedText(name, opts.signedBy), opts.ip),
    ],
  };
  return patchBookingRecord(bookingId, { contract });
}

export function guestAcceptBookingContract(
  bookingId: string,
  opts: { name: string; ip?: string; userAgent?: string; phone?: string; notes?: string }
): BookingRecord | undefined {
  const booking = getBookingById(bookingId);
  if (!booking?.contract) return undefined;

  const name = opts.name.trim().slice(0, 160);
  if (!booking.contract.guestAcceptedAt) {
    if (name.length < 3) return undefined;
    const acceptedAt = nowIso();
    const acceptedPlainText = contractPlainLines(booking.contract).join("\n");
    const contract: BookingContractRecord = {
      ...booking.contract,
      guestAcceptedAt: acceptedAt,
      guestAcceptedName: name,
      guestAcceptedIp: opts.ip,
      guestAcceptedUserAgent: opts.userAgent?.slice(0, 300),
      acceptedPlainText,
      acceptedSha256: sha256Text(acceptedPlainText),
      events: [
        ...booking.contract.events,
        event("guest", "signed", `El huésped firmó como «${name}».`, opts.ip, opts.userAgent),
      ],
    };
    const saved = patchBookingRecord(bookingId, {
      contract,
      guestPhone: opts.phone || booking.guestPhone,
      guestFinishNotes: opts.notes || booking.guestFinishNotes,
    });
    if (saved) {
      enqueueBookingOutbound("booking.contract_signed", saved);
      return confirmBookingAfterGuestContract(saved.id) ?? saved;
    }
    return undefined;
  }

  return confirmBookingAfterGuestContract(bookingId) ?? booking;
}

export function contractIsFullyAccepted(c: BookingContractRecord | undefined): boolean {
  return Boolean(c?.hostAcceptedAt && c?.guestAcceptedAt);
}

function stamp(iso: string): string {
  return `${iso.slice(0, 19).replace("T", " ")} UTC`;
}

function signatureAndHistoryLines(c: BookingContractRecord, hostName: string, money: (n: number) => string): string[] {
  const s = c.snapshot;
  return [
    "FIRMAS",
    c.hostAcceptedAt
      ? `Anfitrión (${c.hostAcceptedName ?? hostName}): ${stamp(c.hostAcceptedAt)}${c.hostAcceptedIp ? ` · IP ${c.hostAcceptedIp}` : ""}`
      : "Anfitrión: pendiente de firma",
    c.guestAcceptedAt
      ? `Huésped (${c.guestAcceptedName ?? s.guestName}): ${stamp(c.guestAcceptedAt)}${c.guestAcceptedIp ? ` · IP ${c.guestAcceptedIp}` : ""}`
      : "Huésped: pendiente de firma",
    c.acceptedSha256 ? `Huella SHA-256 del texto aceptado: ${c.acceptedSha256}` : "",
    "",
    ...(c.previousVersions?.length
      ? [
          "VERSIONES ANTERIORES",
          ...c.previousVersions.flatMap((v, i) => [
            `Versión ${i + 1} (${v.snapshot.checkIn} → ${v.snapshot.checkOut}, ${money(v.snapshot.totalMxn)}) · reemplazada ${stamp(v.supersededAt)}`,
            `  Cambios: ${v.changes.join("; ")}`,
            v.guestAcceptedAt
              ? `  Firmada por el huésped (${v.guestAcceptedName ?? s.guestName}) el ${stamp(v.guestAcceptedAt)}${v.acceptedSha256 ? ` · SHA-256 ${v.acceptedSha256}` : ""}`
              : "  Sin firma del huésped",
          ]),
          "",
        ]
      : []),
  ];
}

function eventLines(c: BookingContractRecord): string[] {
  return [
    "BITÁCORA",
    ...c.events.map(
      (e) => `${stamp(e.at)} · ${e.actor} · ${e.action}${e.detail ? ` — ${e.detail}` : ""}${e.ip ? ` · IP ${e.ip}` : ""}`
    ),
  ];
}

export function contractPlainLines(c: BookingContractRecord): string[] {
  if (c.snapshot.format !== 2 || !c.snapshot.jurisdiction) return legacyContractPlainLines(c);
  const s = c.snapshot;
  const j = s.jurisdiction!;
  const hostName = s.hostLegalName || "Anfitrión";
  const money = (n: number) => `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN`;
  const extra = (s.extraClauses ?? "").trim();
  return [
    "CONTRATO DE HOSPEDAJE TEMPORAL ENTRE PARTICULARES",
    s.templateTitle,
    `Lugar del inmueble: ${j.label}`,
    `Generado ${stamp(c.generatedAt)}`,
    "",
    `Celebran este contrato, por una parte, ${hostName} («el anfitrión») y, por la otra, ${s.guestName} («el huésped»), quienes se reconocen capacidad para obligarse y acuerdan lo siguiente.`,
    "",
    "PARTES",
    `Anfitrión: ${hostName}`,
    `Domicilio del anfitrión: ${given(s.hostAddress)}`,
    `Correo del anfitrión: ${given(s.hostEmail)}`,
    `Teléfono del anfitrión: ${given(s.hostPhone)}`,
    "",
    `Huésped: ${s.guestName}`,
    `Domicilio del huésped: ${given(s.guestAddress)}`,
    `Correo del huésped: ${given(s.guestEmail)}`,
    `Teléfono del huésped: ${given(s.guestPhone)}`,
    "",
    "INMUEBLE",
    s.listingTitle,
    `Dirección: ${s.propertyAddress || "no declarada"}`,
    `Ocupación máxima: ${s.maxGuests ?? 1} persona${s.maxGuests === 1 ? "" : "s"}`,
    "",
    "ESTANCIA",
    `Entrada ${s.checkIn} · salida ${s.checkOut} · ${s.nights} noche${s.nights === 1 ? "" : "s"}`,
    "",
    "CONTRAPRESTACIÓN",
    `Hospedaje: ${money(s.stayMxn)}`,
    `Limpieza: ${money(s.cleaningMxn)}`,
    ...(s.taxMxn && s.taxMxn > 0
      ? [
          ...(s.taxLines ?? []).map(
            (l) => `${s.taxIncluded ? "Incluye " : ""}${l.name} (${l.ratePct}%): ${money(l.amountMxn)}`
          ),
          ...(s.hostTaxId ? [`Registro fiscal del anfitrión: ${s.hostTaxId}`] : []),
        ]
      : []),
    ...(s.platformFeeMxn > 0
      ? [`Cargo de servicio de la herramienta de reservas: ${money(s.platformFeeMxn)} (no forma parte del precio del hospedaje)`]
      : []),
    `Total: ${money(s.totalMxn)}`,
    `Depósito en garantía: ${s.depositMxn > 0 ? money(s.depositMxn) : "no se pacta depósito"}`,
    ...(s.depositMxn > 0 ? [s.depositNote] : []),
    "",
    "REGLAS DEL ALOJAMIENTO",
    `Fumar: ${ruleLabel(s.rules.smoking)}`,
    `Mascotas: ${ruleLabel(s.rules.pets)}`,
    `Fiestas: ${ruleLabel(s.rules.parties)}`,
    `Niños: ${ruleLabel(s.rules.children)}`,
    "",
    "CANCELACIÓN",
    s.cancellationPolicy,
    "",
    ...j.clauses.flatMap((cl) => [cl.title, cl.text, ""]),
    ...(extra ? ["CLÁUSULAS ADICIONALES DEL ANFITRIÓN", extra, ""] : []),
    "LEY APLICABLE Y TRIBUNALES",
    j.governingLaw,
    j.courts,
    "",
    ...signatureAndHistoryLines(c, hostName, money),
    ...eventLines(c),
  ].filter((line, i, arr) => !(line === "" && arr[i - 1] === ""));
}

function legacyContractPlainLines(c: BookingContractRecord): string[] {
  const s = c.snapshot as BookingContractSnapshot & { hostName?: string };
  const hostName = s.hostLegalName || s.hostName || "Anfitrión";
  const money = (n: number) =>
    `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN`;
  const extra = (s.extraClauses ?? "").trim();
  return [
    "CONTRATO DE RESERVA — CABIBEE",
    `${s.templateTitle ?? "Reserva"} · plantilla ${c.templateId}`,
    `Generado ${c.generatedAt.slice(0, 19).replace("T", " ")} UTC`,
    "",
    "PARTES",
    `Anfitrión: ${hostName}`,
    `Domicilio anfitrión: ${given(s.hostAddress)}`,
    `Correo anfitrión: ${given(s.hostEmail)}`,
    `Teléfono anfitrión: ${given(s.hostPhone)}`,
    "",
    `Huésped: ${s.guestName}`,
    `Domicilio huésped: ${given(s.guestAddress)}`,
    `Correo huésped: ${given(s.guestEmail)}`,
    `Teléfono huésped: ${given(s.guestPhone)}`,
    "",
    "INMUEBLE",
    `${s.listingTitle} · ${s.listingCity}, ${s.listingZone}`,
    `Dirección: ${s.propertyAddress ?? "no declarada"}`,
    "",
    "ESTANCIA",
    `${s.checkIn} → ${s.checkOut} · ${s.nights} noche${s.nights === 1 ? "" : "s"}`,
    "",
    "MONTOS",
    `Estancia: ${money(s.stayMxn)}`,
    `Limpieza: ${money(s.cleaningMxn)}`,
    ...(s.taxMxn && s.taxMxn > 0
      ? [
          ...(s.taxLines ?? []).map(
            (l) => `${s.taxIncluded ? "Incluye " : ""}${l.name} (${l.ratePct}%): ${money(l.amountMxn)}`
          ),
          ...(s.hostTaxId ? [`Registro fiscal del anfitrión: ${s.hostTaxId}`] : []),
        ]
      : []),
    ...(s.platformFeeMxn > 0 ? [`Cargo de servicio: ${money(s.platformFeeMxn)}`] : []),
    `Total: ${money(s.totalMxn)}`,
    `Depósito (fuera de Cabibee): ${s.depositMxn > 0 ? money(s.depositMxn) : "no declarado"}`,
    s.depositNote,
    "",
    "REGLAS DEL ALOJAMIENTO",
    `Fumar: ${ruleLabel(s.rules.smoking)}`,
    `Mascotas: ${ruleLabel(s.rules.pets)}`,
    `Fiestas: ${ruleLabel(s.rules.parties)}`,
    `Niños: ${ruleLabel(s.rules.children)}`,
    "",
    ...(extra ? ["CLÁUSULAS DEL ANFITRIÓN", extra, ""] : []),
    "CANCELACIÓN",
    s.cancellationPolicy,
    "",
    "FIRMAS",
    c.hostAcceptedAt
      ? `Anfitrión (${c.hostAcceptedName ?? hostName}): ${c.hostAcceptedAt.slice(0, 19).replace("T", " ")} UTC${c.hostAcceptedIp ? ` · IP ${c.hostAcceptedIp}` : ""}`
      : "Anfitrión: pendiente de firma",
    c.guestAcceptedAt
      ? `Huésped (${c.guestAcceptedName ?? s.guestName}): ${c.guestAcceptedAt.slice(0, 19).replace("T", " ")} UTC${c.guestAcceptedIp ? ` · IP ${c.guestAcceptedIp}` : ""}`
      : "Huésped: pendiente de firma",
    c.acceptedSha256 ? `Huella SHA-256 del texto aceptado: ${c.acceptedSha256}` : "",
    "",
    ...(c.previousVersions?.length
      ? [
          "VERSIONES ANTERIORES",
          ...c.previousVersions.flatMap((v, i) => [
            `Versión ${i + 1} (${v.snapshot.checkIn} → ${v.snapshot.checkOut}, ${money(v.snapshot.totalMxn)}) · reemplazada ${v.supersededAt.slice(0, 19).replace("T", " ")} UTC`,
            `  Cambios: ${v.changes.join("; ")}`,
            v.guestAcceptedAt
              ? `  Firmada por el huésped (${v.guestAcceptedName ?? s.guestName}) el ${v.guestAcceptedAt.slice(0, 19).replace("T", " ")} UTC${v.acceptedSha256 ? ` · SHA-256 ${v.acceptedSha256}` : ""}`
              : "  Sin firma del huésped",
          ]),
          "",
        ]
      : []),
    s.facilitatorNote,
    "",
    "BITÁCORA",
    ...c.events.map(
      (e) =>
        `${e.at.slice(0, 19).replace("T", " ")} UTC · ${e.actor} · ${e.action}${e.detail ? ` — ${e.detail}` : ""}${e.ip ? ` · IP ${e.ip}` : ""}`
    ),
  ].filter((line, i, arr) => !(line === "" && arr[i - 1] === ""));
}
