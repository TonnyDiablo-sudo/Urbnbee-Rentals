import "server-only";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { getDraft, saveDraft, type AssociateDraft, type DraftContact } from "@/lib/associate-drafts-store";
import { removeDraftPhotos } from "@/lib/associate-photos";
import { geocodePlace } from "@/lib/geocode";
import { syncHostBadgeToListings } from "@/lib/host-verification";
import { draftToListingPartial } from "@/lib/listing-import-llm";
import type { ListingImportLlmPayload } from "@/lib/listing-import-types";
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

function nameSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .split(".")
    .slice(0, 2)
    .join(".");
  return slug || "anfitrion";
}

export function generatePlaceholderEmail(fullName: string): string {
  const base = nameSlug(fullName);
  for (let i = 0; i < 20; i++) {
    const email = `${base}.${randomInt(1000, 10000)}@${PLACEHOLDER_EMAIL_DOMAIN}`;
    if (!findUserByEmail(email)) return email;
  }
  return `anfitrion.${Date.now()}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

export function isPlaceholderEmail(email: string | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`));
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
  | { ok: false; error: string; status: number };

function cleanPhone(v: string | undefined): string | undefined {
  const t = (v ?? "").replace(/[^\d+\s-]/g, "").trim();
  return t.length >= 8 ? t.slice(0, 30) : undefined;
}

export async function publishDraft(opts: {
  associate: UserRecord;
  draftId: string;
  listing: ListingImportLlmPayload;
  contact: DraftContact;
  photos: string[];
  target: PublishTarget;
}): Promise<PublishResult> {
  const draft = getDraft(opts.draftId);
  if (!draft || (draft.associateId !== opts.associate.id && opts.associate.role !== "admin")) {
    return { ok: false, error: "Borrador no encontrado.", status: 404 };
  }
  if (draft.status !== "pending") return { ok: false, error: "Este borrador ya se procesó.", status: 409 };
  const title = opts.listing.title?.trim();
  if (!title) return { ok: false, error: "El anuncio necesita título.", status: 400 };

  const allowedPrefix = `/uploads/associate-drafts/${draft.id}/`;
  const photos = opts.photos.filter((p) => draft.photos.includes(p) && p.startsWith(allowedPrefix)).slice(0, 40);
  const warnings: string[] = [];

  let host: UserRecord;
  let created = false;
  let credentials: { email: string; password: string } | undefined;

  if (opts.target.kind === "existing") {
    const existing = findUserById(opts.target.hostId);
    if (!associateCanManageHost(opts.associate, existing)) {
      return { ok: false, error: "Esa cuenta no es tuya o el dueño ya la reclamó.", status: 403 };
    }
    host = existing;
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
      email: realEmail || undefined,
    });
    created = true;
    credentials = { email, password };
  }

  const l = opts.listing;
  const where = [l.zone, l.city, l.county, l.state, l.country || "México"].filter(Boolean).join(", ");
  const coords = (await geocodePlace(where)) ?? (l.city ? await geocodePlace([l.city, l.state, l.country || "México"].filter(Boolean).join(", ")) : null);
  if (!coords) warnings.push("No se encontró la ubicación en el mapa; el dueño puede ajustarla en el editor.");

  const listing = createListing(host.id, {
    ...draftToListingPartial({ ...l, title }),
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
    listing: l,
    contact: opts.contact,
    photos,
    status: "published",
    resultHostId: host.id,
    resultListingId: listing.id,
  });
  await removeDraftPhotos(draft.id, photos);

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
  return saveDraft({ ...draft, status: "discarded", photos: [] });
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
  updateUserAuth(host.id, { passwordHash: await bcrypt.hash(password, 11), mustChangePassword: true });
  return { ok: true, email: host.email, password };
}

export function hostContactSummary(hostId: string): { phone?: string; whatsapp?: string } {
  const p = getHostProfile(hostId);
  return { phone: p?.phone, whatsapp: p?.whatsapp };
}
