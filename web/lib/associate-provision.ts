import "server-only";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { removeSourceShots } from "@/lib/associate-capture";
import { rememberOutreachPassword } from "@/lib/associate-outreach-store";
import { applyDraftEdits, draftPublishProblems, type DraftEdits } from "@/lib/associate-draft-edits";
import { getDraft, saveDraft, type AssociateDraft, type DraftContact } from "@/lib/associate-drafts-store";
import { removeDraftPhotos } from "@/lib/associate-photos";
import { listingHasEngine } from "@/lib/booking-engine-slots";
import { geocodePlace } from "@/lib/geocode";
import { hostListingToDetail } from "@/lib/host-listing-mapper";
import { hostCanTakeBookingPayments } from "@/lib/host-stripe";
import { syncHostBadgeToListings } from "@/lib/host-verification";
import type { ListingDetail } from "@/lib/listing-detail-data";
import { draftToListingPartial } from "@/lib/listing-import-llm";
import type { Listing } from "@/lib/mock-data";
import {
  buildListingRecord,
  createListing,
  createUser,
  findUserByEmail,
  findUserById,
  getHostProfile,
  updateUserAuth,
  upsertHostProfile,
} from "@/lib/marketplace-store";
import type { HostListingRecord, HostProfileRecord, UserRecord } from "@/lib/marketplace-types";

export const PLACEHOLDER_EMAIL_DOMAIN = "cuentas.cabibee.com";

const LETTERS = "abcdefghjkmnpqrstuvwxyz";

/** Fácil de dictar por teléfono: Cabi-4821-kxqm. */
export function generateTempPassword(): string {
  const digits = String(randomInt(1000, 10000));
  let tail = "";
  for (let i = 0; i < 4; i++) tail += LETTERS[randomInt(0, LETTERS.length)];
  return `Cabi-${digits}-${tail}`;
}

/** «Juan Pérez López» → «juanperez»: nombre + primer apellido, sin acentos ni puntos. */
function nameSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .slice(0, 16);
  return slug || "anfitrion";
}

/** Cuenta sin correo: el usuario es «juanperez4821»; por dentro se guarda como juanperez4821@cuentas.cabibee.com. */
export function generatePlaceholderEmail(fullName: string): string {
  const base = nameSlug(fullName);
  for (let i = 0; i < 20; i++) {
    const email = `${base}${randomInt(1000, 10000)}@${PLACEHOLDER_EMAIL_DOMAIN}`;
    if (!findUserByEmail(email)) return email;
  }
  return `anfitrion${Date.now()}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

export function isPlaceholderEmail(email: string | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`));
}

/** Lo que el dueño escribe para entrar: el usuario corto si el correo es interno, si no el correo. */
export function loginNameFor(email: string): string {
  return isPlaceholderEmail(email) ? email.slice(0, email.lastIndexOf("@")) : email;
}

/** Acepta «juanperez4821» (sin @) y lo convierte al correo interno. */
export function emailFromLoginName(input: string): string {
  const v = input.trim().toLowerCase();
  return !v || v.includes("@") ? v : `${v}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

/** El asociado sólo maneja las cuentas que él creó y que el dueño todavía no reclama. Admin, todas las de asociados. */
export function associateCanManageHost(associate: UserRecord, host: UserRecord | undefined): host is UserRecord {
  if (!host?.provisionedBy || host.claimedAt) return false;
  return associate.role === "admin" || host.provisionedBy === associate.id;
}

export type PublishTarget =
  | { kind: "new"; fullName: string; email?: string; phone?: string; whatsapp?: string }
  | { kind: "existing"; hostId: string };

export type PublishResult =
  | {
      ok: true;
      hostId: string;
      listingId: string;
      listingSlug: string;
      created: boolean;
      credentials?: { email: string; password: string };
      warnings: string[];
    }
  | { ok: false; error: string; problems?: string[]; status: number };

/** El anuncio no lleva enlaces: los de Trovit, Inmuebles24, etc. mandarían a la competencia. */
export function stripLinks(text: string): string {
  return text
    .replace(/\bhttps?:\/\/\S+/gi, "")
    .replace(/\bwww\.\S+/gi, "")
    .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|mx|net|org|io|app|me|ly|co)(?:\.mx)?\/\S*/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanPhone(v: string | undefined): string | undefined {
  const t = (v ?? "").replace(/[^\d+\s-]/g, "").trim();
  return t.length >= 8 ? t.slice(0, 30) : undefined;
}

function newHostContact(target: Extract<PublishTarget, { kind: "new" }>, contact: DraftContact): Partial<HostProfileRecord> {
  const phone = cleanPhone(target.phone);
  return {
    phone,
    whatsapp: cleanPhone(target.whatsapp) ?? phone,
    email: contact.email || target.email?.trim().toLowerCase() || undefined,
    airbnbUrl: contact.profileUrl,
  };
}

/** A una cuenta que ya existe sólo se le llenan los datos de contacto que le faltan. */
function existingHostContact(profile: HostProfileRecord | undefined, contact: DraftContact): Partial<HostProfileRecord> {
  return {
    phone: profile?.phone || cleanPhone(contact.phone),
    whatsapp: profile?.whatsapp || cleanPhone(contact.whatsapp),
    email: profile?.email || contact.email,
    airbnbUrl: profile?.airbnbUrl || contact.profileUrl,
  };
}

async function geocodeDraft(draft: AssociateDraft): Promise<{ lat: number; lng: number } | null> {
  const l = draft.listing;
  const country = l.country || "México";
  const tries = [
    draft.addressMode !== "exact"
      ? [draft.addressApprox, l.zone, l.city, l.state, country]
      : [l.addressLine, l.zone, l.city, l.state, country],
    [l.zone, l.city, l.county, l.state, country],
    [l.city, l.state, country],
  ].map((parts) => parts.filter(Boolean).join(", "));
  for (const q of [...new Set(tries)]) {
    if (!q || q === country) continue;
    const coords = await geocodePlace(q);
    if (coords) return coords;
  }
  return null;
}

/** Lo que se guarda como anuncio publicado; la vista previa usa exactamente lo mismo. */
function draftListingFields(draft: AssociateDraft, coords: { lat: number; lng: number } | null): Partial<HostListingRecord> {
  const l = draft.listing;
  const approximate = draft.addressMode !== "exact";
  const title = stripLinks(l.title ?? "") || l.title?.trim() || "";
  return {
    ...draftToListingPartial({
      ...l,
      title,
      description: l.description ? stripLinks(l.description) : l.description,
      addressLine: approximate ? "" : l.addressLine,
    }),
    ...(approximate && draft.addressApprox ? { addressApprox: draft.addressApprox } : {}),
    photos: draft.photos,
    published: true,
    ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
  };
}

export type DraftPreview = {
  detail: ListingDetail;
  card: Listing;
  unclaimed: boolean;
  bookable: boolean;
  mapFound: boolean;
};

/** El anuncio tal como quedaría publicado, sin crear la cuenta ni guardar nada. */
export async function buildDraftPreview(opts: {
  associate: UserRecord;
  draftId: string;
  edits: DraftEdits;
  target: PublishTarget;
}): Promise<{ ok: true; preview: DraftPreview } | { ok: false; error: string; status: number }> {
  const original = getDraft(opts.draftId);
  if (!original || (original.associateId !== opts.associate.id && opts.associate.role !== "admin")) {
    return { ok: false, error: "Borrador no encontrado.", status: 404 };
  }
  const allowedPrefix = `/uploads/associate-drafts/${original.id}/`;
  const draft = applyDraftEdits(original, {
    ...opts.edits,
    photos: opts.edits.photos.filter((p) => p.startsWith(allowedPrefix)).slice(0, 40),
  });

  let user: UserRecord;
  let profile: HostProfileRecord | undefined;
  if (opts.target.kind === "existing") {
    const existing = findUserById(opts.target.hostId);
    if (!associateCanManageHost(opts.associate, existing)) {
      return { ok: false, error: "Esa cuenta no es tuya o el dueño ya la reclamó.", status: 403 };
    }
    user = existing;
    const current = getHostProfile(existing.id);
    profile = { ...(current ?? ({ userId: existing.id } as HostProfileRecord)), ...existingHostContact(current, draft.contact) };
  } else {
    const realEmail = opts.target.email?.trim().toLowerCase();
    user = {
      id: "usr_preview",
      email: realEmail || `preview@${PLACEHOLDER_EMAIL_DOMAIN}`,
      passwordHash: "",
      fullName: opts.target.fullName.trim() || draft.contact.hostName || "Anfitrión",
      role: "host",
      provisionedBy: opts.associate.id,
      placeholderEmail: !realEmail,
      createdAt: new Date().toISOString(),
    } as UserRecord;
    profile = { userId: user.id, ...newHostContact(opts.target, draft.contact) } as HostProfileRecord;
  }

  const coords = await geocodeDraft(draft);
  const record = buildListingRecord(user.id, draftListingFields(draft, coords));
  const detail = hostListingToDetail(record, { user, profile });
  return {
    ok: true,
    preview: {
      detail,
      card: {
        id: record.id,
        slug: record.slug,
        title: detail.title,
        imageSrc: record.photos[0] ?? "",
        pricePerNight: detail.pricePerNight,
        pricePerMonth: detail.pricePerMonth,
        currency: "MXN",
        rating: detail.reviewSummary?.avg ?? 0,
        categoryLabel: detail.category,
        spaceType: detail.spaceType,
        guests: detail.guests,
        bedrooms: detail.bedrooms,
        bathrooms: detail.bathrooms,
        verified: detail.verified,
        identityVerified: detail.identityVerified,
        locationVerified: detail.locationVerified,
      },
      unclaimed: !user.claimedAt,
      bookable: opts.target.kind === "existing" && listingHasEngine(record) && hostCanTakeBookingPayments(user.id),
      mapFound: Boolean(coords),
    },
  };
}

/** Destino al publicar: cuenta nueva con los datos del formulario o una cuenta que ya creó el asociado. */
export function parsePublishTarget(raw: unknown, contact: DraftContact): PublishTarget {
  const t = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => {
    if (typeof v !== "string") return undefined;
    const s = v.replace(/[<>]/g, "").trim().slice(0, max);
    return s || undefined;
  };
  if (t.kind === "existing" && typeof t.hostId === "string") return { kind: "existing", hostId: t.hostId };
  return {
    kind: "new",
    fullName: str(t.fullName, 120) ?? contact.hostName ?? "",
    email: str(t.email, 160),
    phone: str(t.phone, 40) ?? contact.phone,
    whatsapp: str(t.whatsapp, 40) ?? contact.whatsapp,
  };
}

function hostHasContact(hostId: string): boolean {
  const p = getHostProfile(hostId);
  return Boolean(p?.phone || p?.whatsapp || p?.email || p?.airbnbUrl);
}

export async function publishDraft(opts: {
  associate: UserRecord;
  draftId: string;
  edits: DraftEdits;
  target: PublishTarget;
}): Promise<PublishResult> {
  const original = getDraft(opts.draftId);
  if (!original || (original.associateId !== opts.associate.id && opts.associate.role !== "admin")) {
    return { ok: false, error: "Borrador no encontrado.", status: 404 };
  }
  if (original.status !== "pending") return { ok: false, error: "Este borrador ya se procesó.", status: 409 };

  const allowedPrefix = `/uploads/associate-drafts/${original.id}/`;
  const draft = applyDraftEdits(original, {
    ...opts.edits,
    photos: opts.edits.photos.filter((p) => p.startsWith(allowedPrefix)).slice(0, 40),
  });
  const existing = opts.target.kind === "existing" ? findUserById(opts.target.hostId) : undefined;
  const problems = draftPublishProblems(draft, { hostHasContact: existing ? hostHasContact(existing.id) : false });
  if (problems.length) {
    saveDraft(draft);
    return { ok: false, error: problems[0], problems, status: 400 };
  }
  const photos = draft.photos;
  const contact = draft.contact;
  const warnings: string[] = [];

  let host: UserRecord;
  let created = false;
  let credentials: { email: string; password: string } | undefined;

  if (opts.target.kind === "existing") {
    if (!associateCanManageHost(opts.associate, existing)) {
      return { ok: false, error: "Esa cuenta no es tuya o el dueño ya la reclamó.", status: 403 };
    }
    host = existing;
    upsertHostProfile(host.id, existingHostContact(getHostProfile(host.id), contact));
  } else {
    const fullName = opts.target.fullName.trim();
    if (fullName.length < 2) return { ok: false, error: "Escribe el nombre del anfitrión.", status: 400 };
    const realEmail = opts.target.email?.trim().toLowerCase();
    if (realEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(realEmail)) {
      return { ok: false, error: "El correo no es válido.", status: 400 };
    }
    if (realEmail && findUserByEmail(realEmail)) {
      return { ok: false, error: "Ese correo ya tiene cuenta en Cabibee.", status: 409 };
    }
    const email = realEmail || generatePlaceholderEmail(fullName);
    const password = generateTempPassword();
    const phone = cleanPhone(opts.target.phone);
    host = createUser({
      email,
      passwordHash: await bcrypt.hash(password, 11),
      fullName,
      phone,
      role: "host",
      provisionedBy: opts.associate.id,
      placeholderEmail: !realEmail,
      mustChangePassword: true,
    });
    upsertHostProfile(host.id, newHostContact(opts.target, contact));
    rememberOutreachPassword(host.id, opts.associate.id, password);
    created = true;
    credentials = { email: loginNameFor(email), password };
  }

  const coords = await geocodeDraft(draft);
  if (!coords) warnings.push("No se encontró la ubicación en el mapa; el dueño puede ajustarla en el editor.");

  const listing = createListing(host.id, {
    ...draftListingFields(draft, coords),
    source: {
      kind: draft.source.kind,
      url: draft.source.url,
      site: draft.source.site,
      capturedBy: opts.associate.id,
      capturedAt: draft.createdAt,
    },
  });
  if (!created) syncHostBadgeToListings(host.id);

  saveDraft({
    ...draft,
    status: "published",
    resultHostId: host.id,
    resultListingId: listing.id,
    removedPhotos: undefined,
    createdAccount: created,
    publishedAt: new Date().toISOString(),
    sourceText: undefined,
    sourceLinks: undefined,
    sourceShots: undefined,
  });
  await removeDraftPhotos(draft.id, photos);
  await removeSourceShots(original.sourceShots);

  return {
    ok: true,
    hostId: host.id,
    listingId: listing.id,
    listingSlug: listing.slug,
    created,
    credentials,
    warnings,
  };
}

export async function discardDraft(associate: UserRecord, draftId: string): Promise<AssociateDraft | null> {
  const draft = getDraft(draftId);
  if (!draft || (draft.associateId !== associate.id && associate.role !== "admin")) return null;
  if (draft.status !== "pending") return draft;
  await removeDraftPhotos(draft.id, []);
  await removeSourceShots(draft.sourceShots);
  return saveDraft({
    ...draft,
    status: "discarded",
    photos: [],
    removedPhotos: undefined,
    sourceText: undefined,
    sourceLinks: undefined,
    sourceShots: undefined,
  });
}

/** Nueva contraseña temporal mientras el dueño no haya reclamado la cuenta. */
export async function resetTempPassword(
  associate: UserRecord,
  hostId: string
): Promise<{ ok: true; email: string; password: string } | { ok: false; error: string }> {
  const host = findUserById(hostId);
  if (!associateCanManageHost(associate, host)) {
    return { ok: false, error: "Esa cuenta no es tuya o el dueño ya la reclamó." };
  }
  const password = generateTempPassword();
  updateUserAuth(host.id, {
    passwordHash: await bcrypt.hash(password, 11),
    mustChangePassword: true,
    passwordChangedAt: new Date().toISOString(),
  });
  rememberOutreachPassword(host.id, host.provisionedBy!, password);
  return { ok: true, email: loginNameFor(host.email), password };
}

export function hostContactSummary(hostId: string): { phone?: string; whatsapp?: string } {
  const p = getHostProfile(hostId);
  return { phone: p?.phone, whatsapp: p?.whatsapp };
}
