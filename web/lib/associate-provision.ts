import "server-only";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { removeSourceShots } from "@/lib/associate-capture";
import { applyDraftEdits, draftPublishProblems, type DraftEdits } from "@/lib/associate-draft-edits";
import { getDraft, saveDraft, type AssociateDraft } from "@/lib/associate-drafts-store";
import { removeDraftPhotos } from "@/lib/associate-photos";
import { geocodePlace } from "@/lib/geocode";
import { syncHostBadgeToListings } from "@/lib/host-verification";
import { draftToListingPartial } from "@/lib/listing-import-llm";
import {
  createListing,
  createUser,
  findUserByEmail,
  findUserById,
  getHostProfile,
  updateUserAuth,
  upsertHostProfile,
} from "@/lib/marketplace-store";
import type { UserRecord } from "@/lib/marketplace-types";

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
  const title = stripLinks(draft.listing.title!) || draft.listing.title!.trim();
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
    const profile = getHostProfile(host.id);
    upsertHostProfile(host.id, {
      phone: profile?.phone || cleanPhone(contact.phone),
      whatsapp: profile?.whatsapp || cleanPhone(contact.whatsapp),
      email: profile?.email || contact.email,
      airbnbUrl: profile?.airbnbUrl || contact.profileUrl,
    });
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
    upsertHostProfile(host.id, {
      phone,
      whatsapp: cleanPhone(opts.target.whatsapp) ?? phone,
      email: contact.email || realEmail || undefined,
      airbnbUrl: contact.profileUrl,
    });
    created = true;
    credentials = { email: loginNameFor(email), password };
  }

  const l = draft.listing;
  const approximate = draft.addressMode !== "exact";
  const country = l.country || "México";
  const tries = [
    approximate ? [draft.addressApprox, l.zone, l.city, l.state, country] : [l.addressLine, l.zone, l.city, l.state, country],
    [l.zone, l.city, l.county, l.state, country],
    [l.city, l.state, country],
  ].map((parts) => parts.filter(Boolean).join(", "));
  let coords: { lat: number; lng: number } | null = null;
  for (const q of [...new Set(tries)]) {
    if (!q || q === country) continue;
    coords = await geocodePlace(q);
    if (coords) break;
  }
  if (!coords) warnings.push("No se encontró la ubicación en el mapa; el dueño puede ajustarla en el editor.");

  const listing = createListing(host.id, {
    ...draftToListingPartial({
      ...l,
      title,
      description: l.description ? stripLinks(l.description) : l.description,
      addressLine: approximate ? "" : l.addressLine,
    }),
    ...(approximate && draft.addressApprox ? { addressApprox: draft.addressApprox } : {}),
    photos,
    published: true,
    ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
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
  return { ok: true, email: loginNameFor(host.email), password };
}

export function hostContactSummary(hostId: string): { phone?: string; whatsapp?: string } {
  const p = getHostProfile(hostId);
  return { phone: p?.phone, whatsapp: p?.whatsapp };
}
