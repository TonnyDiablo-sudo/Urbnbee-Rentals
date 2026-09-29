import "server-only";
import {
  contractDepositNote,
  contractFacilitatorNote,
  defaultListingContract,
  getContractTemplate,
} from "@/lib/booking-contract-templates";
import type {
  BookingContractActor,
  BookingContractEvent,
  BookingContractRecord,
  BookingContractSnapshot,
} from "@/lib/booking-contract-types";
import type { BookingRecord } from "@/lib/booking-types";
import { attachDepositIfNeeded } from "@/lib/booking-deposit";
import { getBookingById, patchBookingRecord } from "@/lib/bookings-store";
import { findUserById, getHostProfile, getListingById } from "@/lib/marketplace-store";
import { platformBookingFeeMxn } from "@/lib/platform-fees";

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
  ip?: string
): BookingContractEvent {
  return { at: nowIso(), actor, action, detail, ip };
}

function cleanName(v: string | undefined, fallback: string): string {
  const t = (v ?? "").trim();
  return t || fallback;
}

export function buildContractSnapshot(booking: BookingRecord): BookingContractSnapshot | null {
  const listingId = booking.hostAdjustedListingId ?? booking.listingId;
  const listing = getListingById(listingId);
  if (!listing) return null;

  const host = findUserById(booking.hostId);
  const hostProfile = getHostProfile(booking.hostId);
  const guest = booking.guestUserId ? findUserById(booking.guestUserId) : undefined;
  const settings = defaultListingContract(listing.contract);
  const template = getContractTemplate(settings.templateId);

  const checkIn = booking.hostAdjustedCheckIn ?? booking.checkIn;
  const checkOut = booking.hostAdjustedCheckOut ?? booking.checkOut;
  const fee = booking.platformFeeMxn ?? platformBookingFeeMxn(booking.estimatedTotalMxn);
  const propertyAddress =
    settings.propertyAddress ||
    [listing.addressLine, listing.zone, listing.city, listing.country].filter(Boolean).join(", ") ||
    `${listing.city || "—"}, ${listing.zone || "—"}`;

  return {
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
    hostEmail: host?.email ?? hostProfile?.email ?? "",
    hostPhone: hostProfile?.phone || host?.phone || "",
    guestName: cleanName(guest?.fullName, booking.guestName),
    guestEmail: guest?.email || booking.guestEmail,
    guestPhone: guest?.phone || booking.guestPhone || "",
    guestAddress: guest?.addressLine || "",
    checkIn,
    checkOut,
    nights: booking.nights,
    stayMxn: Math.max(0, booking.estimatedTotalMxn - (listing.cleaningFee ?? 0)),
    cleaningMxn: listing.cleaningFee ?? booking.cleaningFeeMxn ?? 0,
    platformFeeMxn: fee,
    totalMxn: booking.estimatedTotalMxn + fee,
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
    facilitatorNote: contractFacilitatorNote(),
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
 * Crea el contrato si no existe. El anfitrión firma al aceptar, o al generar
 * una reserva instantánea si ya confirmó la plantilla en el anuncio.
 */
export function ensureBookingContract(
  bookingId: string,
  actor: { role: BookingContractActor; userId?: string; ip?: string; signName?: string }
): BookingRecord | undefined {
  const booking = getBookingById(bookingId);
  if (!booking) return undefined;
  if (booking.contract) return booking;

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
          ? "Reserva instantánea: se usó la plantilla que el anfitrión configuró en el anuncio."
          : "El anfitrión aceptó la solicitud y se generó el contrato.",
        actor.ip
      ),
      ...(hostSigns
        ? [
            event(
              actor.role === "system" ? "host" : actor.role,
              "signed",
              `El anfitrión firmó como «${hostName}».`,
              actor.ip
            ),
          ]
        : []),
    ],
  };

  const saved = patchBookingRecord(bookingId, { contract });
  return saved ? attachDepositIfNeeded(saved) : saved;
}

export function attachContractIfInstant(booking: BookingRecord): BookingRecord {
  if (booking.status !== "CONFIRMED" || booking.contract) return booking;
  return ensureBookingContract(booking.id, { role: "system", userId: booking.hostId }) ?? booking;
}

export function hostSignBookingContract(
  bookingId: string,
  opts: { name: string; userId?: string; ip?: string }
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
      event("host", "signed", `El anfitrión firmó como «${name}».`, opts.ip),
    ],
  };
  return patchBookingRecord(bookingId, { contract });
}

export function guestAcceptBookingContract(
  bookingId: string,
  opts: { name: string; ip?: string; phone?: string; notes?: string }
): BookingRecord | undefined {
  const booking = getBookingById(bookingId);
  if (!booking?.contract) return undefined;

  const name = opts.name.trim().slice(0, 160);
  if (!booking.contract.guestAcceptedAt) {
    if (name.length < 3) return undefined;
    const acceptedAt = nowIso();
    const contract: BookingContractRecord = {
      ...booking.contract,
      guestAcceptedAt: acceptedAt,
      guestAcceptedName: name,
      guestAcceptedIp: opts.ip,
      events: [
        ...booking.contract.events,
        event("guest", "signed", `El huésped firmó como «${name}».`, opts.ip),
      ],
    };
    return patchBookingRecord(bookingId, {
      contract,
      guestPhone: opts.phone || booking.guestPhone,
      guestFinishNotes: opts.notes || booking.guestFinishNotes,
      status: booking.status === "AWAITING_DETAILS" ? "CONFIRMED" : booking.status,
    });
  }

  return booking.status === "AWAITING_DETAILS"
    ? patchBookingRecord(bookingId, { status: "CONFIRMED" })
    : booking;
}

export function contractIsFullyAccepted(c: BookingContractRecord | undefined): boolean {
  return Boolean(c?.hostAcceptedAt && c?.guestAcceptedAt);
}

export function contractPlainLines(c: BookingContractRecord): string[] {
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
    s.hostAddress ? `Domicilio anfitrión: ${s.hostAddress}` : "",
    s.hostEmail ? `Correo anfitrión: ${s.hostEmail}` : "",
    s.hostPhone ? `Teléfono anfitrión: ${s.hostPhone}` : "",
    `Huésped: ${s.guestName}`,
    s.guestAddress ? `Domicilio huésped: ${s.guestAddress}` : "",
    `Correo huésped: ${s.guestEmail}`,
    s.guestPhone ? `Teléfono huésped: ${s.guestPhone}` : "",
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
    `Cargo de servicio Cabibee: ${money(s.platformFeeMxn)}`,
    `Total cobrado en Cabibee: ${money(s.totalMxn)}`,
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
    "",
    s.facilitatorNote,
    "",
    "BITÁCORA",
    ...c.events.map(
      (e) =>
        `${e.at.slice(0, 19).replace("T", " ")} UTC · ${e.actor} · ${e.action}${e.detail ? ` — ${e.detail}` : ""}${e.ip ? ` · IP ${e.ip}` : ""}`
    ),
  ].filter((line, i, arr) => !(line === "" && arr[i - 1] === ""));
}
