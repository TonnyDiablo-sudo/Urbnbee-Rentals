import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import type {
  HostListingRecord,
  HostProfileRecord,
  UserRecord,
  UserRole,
} from "@/lib/marketplace-types";
import type { ListingCategory } from "@/lib/mock-data";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

/** In-memory store (replace with MySQL per SYSTEM_ARCHITECTURE_AND_ROADMAP). */
const usersById = new Map<string, UserRecord>();
const usersByEmail = new Map<string, string>();
const hostProfiles = new Map<string, HostProfileRecord>();
const listingsById = new Map<string, HostListingRecord>();
const slugToListingId = new Map<string, string>();

const STORE_FILE = join(getDataDir(), "marketplace-store.json");

function normalizeListing(l: HostListingRecord): HostListingRecord {
  return {
    ...l,
    bookingApprovalMode: l.bookingApprovalMode ?? "approval",
  };
}

/** Si el JSON en disco cambia (Synology, otro proceso, edición manual), recargamos — evita RAM obsoleta vs disco. */
let cachedDiskMtimeMs = 0;

function persistToDisk() {
  try {
    ensureDir(getDataDir());
    const snapshot = {
      version: 1 as const,
      users: [...usersById.values()],
      emailToUserId: Object.fromEntries(usersByEmail.entries()),
      hostProfiles: Object.fromEntries(hostProfiles.entries()),
      listings: [...listingsById.values()],
    };
    writeFileSync(STORE_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    if (existsSync(STORE_FILE)) {
      cachedDiskMtimeMs = statSync(STORE_FILE).mtimeMs;
    }
  } catch (e) {
    console.warn("[marketplace-store] persist failed:", e);
  }
}

function reloadStoreFromDisk() {
  try {
    if (!existsSync(STORE_FILE)) return;
    const raw = readFileSync(STORE_FILE, "utf8");
    const data = JSON.parse(raw) as {
      users?: UserRecord[];
      emailToUserId?: Record<string, string>;
      hostProfiles?: Record<string, HostProfileRecord>;
      listings?: HostListingRecord[];
    };
    if (!Array.isArray(data.users)) {
      return;
    }
    usersById.clear();
    usersByEmail.clear();
    hostProfiles.clear();
    listingsById.clear();
    slugToListingId.clear();
    for (const u of data.users ?? []) {
      usersById.set(u.id, u);
    }
    const ei = data.emailToUserId ?? {};
    for (const [email, uid] of Object.entries(ei)) {
      usersByEmail.set(email, uid);
    }
    const hp = data.hostProfiles ?? {};
    for (const [uid, p] of Object.entries(hp)) {
      hostProfiles.set(uid, { ...p, userId: uid });
    }
    for (const l of data.listings ?? []) {
      const listing = normalizeListing(l);
      listingsById.set(listing.id, listing);
      slugToListingId.set(listing.slug, listing.id);
    }
    cachedDiskMtimeMs = statSync(STORE_FILE).mtimeMs;
    console.info("[marketplace-store] loaded", usersById.size, "users,", listingsById.size, "listings from disk");
  } catch (e) {
    console.warn("[marketplace-store] load failed:", e);
  }
}

function syncStoreFromDiskIfStale() {
  try {
    if (!existsSync(STORE_FILE)) return;
    const m = statSync(STORE_FILE).mtimeMs;
    if (m === cachedDiskMtimeMs) return;
    reloadStoreFromDisk();
  } catch {
    /* ignore */
  }
}

reloadStoreFromDisk();

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
  const suffix = randomBytes(3).toString("hex");
  return `${base || "alojamiento"}-${suffix}`;
}

export function findUserByEmail(email: string): UserRecord | undefined {
  syncStoreFromDiskIfStale();
  const uid = usersByEmail.get(email.trim().toLowerCase());
  return uid ? usersById.get(uid) : undefined;
}

export function findUserById(userId: string): UserRecord | undefined {
  syncStoreFromDiskIfStale();
  return usersById.get(userId);
}

export function createUser(input: {
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  role: UserRole;
}): UserRecord {
  syncStoreFromDiskIfStale();
  const email = input.email.trim().toLowerCase();
  if (usersByEmail.has(email)) {
    throw new Error("EMAIL_IN_USE");
  }
  const user: UserRecord = {
    id: id("usr"),
    email,
    passwordHash: input.passwordHash,
    fullName: input.fullName.trim(),
    phone: input.phone?.trim(),
    role: input.role,
    createdAt: nowIso(),
  };
  usersById.set(user.id, user);
  usersByEmail.set(email, user.id);

  const profile: HostProfileRecord = {
    userId: user.id,
    bio: "",
    phone: user.phone,
    email: email,
  };
  hostProfiles.set(user.id, profile);

  persistToDisk();
  return user;
}

export function getHostProfile(userId: string): HostProfileRecord | undefined {
  syncStoreFromDiskIfStale();
  return hostProfiles.get(userId);
}

export function upsertHostProfile(
  userId: string,
  patch: Partial<Omit<HostProfileRecord, "userId">>
): HostProfileRecord {
  const prev = hostProfiles.get(userId) ?? { userId, bio: "" };
  const next: HostProfileRecord = {
    ...prev,
    ...patch,
    userId,
  };
  hostProfiles.set(userId, next);
  persistToDisk();
  return next;
}

export function listListingsForHost(hostId: string): HostListingRecord[] {
  syncStoreFromDiskIfStale();
  const rows = [...listingsById.values()].filter((l) => l.hostId === hostId);
  rows.sort((a, b) => {
    if (a.published !== b.published) return a.published ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  return rows;
}

export function getListingById(listingId: string): HostListingRecord | undefined {
  syncStoreFromDiskIfStale();
  return listingsById.get(listingId);
}

export function getListingBySlug(slug: string): HostListingRecord | undefined {
  syncStoreFromDiskIfStale();
  const lid = slugToListingId.get(slug);
  return lid ? listingsById.get(lid) : undefined;
}

export function getPublishedByCategory(category: ListingCategory): HostListingRecord[] {
  syncStoreFromDiskIfStale();
  return [...listingsById.values()].filter((l) => l.published && l.categoryKey === category);
}

export function createListing(hostId: string, partial?: Partial<HostListingRecord>): HostListingRecord {
  syncStoreFromDiskIfStale();
  const slug = slugifyTitle(partial?.title || "mi-alojamiento");
  const listing: HostListingRecord = {
    id: id("lst"),
    hostId,
    slug,
    title: partial?.title?.trim() || "Mi alojamiento",
    description: partial?.description ?? "",
    categoryKey: partial?.categoryKey ?? "habitaciones",
    spaceType: partial?.spaceType ?? "Espacio completo",
    city: partial?.city ?? "",
    zone: partial?.zone ?? "",
    county: partial?.county ?? "",
    country: partial?.country ?? "México",
    addressLine: partial?.addressLine ?? "",
    lat: partial?.lat ?? 19.4326,
    lng: partial?.lng ?? -99.1332,
    guests: partial?.guests ?? 2,
    bedrooms: partial?.bedrooms ?? 1,
    bathrooms: partial?.bathrooms ?? 1,
    size: partial?.size,
    pricePerNight: partial?.pricePerNight ?? 500,
    cleaningFee: partial?.cleaningFee ?? 0,
    nightlyPriceOverrides:
      partial?.nightlyPriceOverrides && typeof partial.nightlyPriceOverrides === "object"
        ? { ...partial.nightlyPriceOverrides }
        : undefined,
    photos: partial?.photos ?? [],
    amenities: partial?.amenities ?? [],
    rules: partial?.rules ?? {
      smoking: false,
      pets: null,
      parties: false,
      children: true,
    },
    blockedDates: partial?.blockedDates ?? [],
    verified: false,
    published: false,
    bookingApprovalMode: partial?.bookingApprovalMode ?? "approval",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  listingsById.set(listing.id, listing);
  slugToListingId.set(listing.slug, listing.id);
  persistToDisk();
  return listing;
}

export function updateListing(
  listingId: string,
  hostId: string,
  patch: Partial<HostListingRecord>
): HostListingRecord | undefined {
  const prev = listingsById.get(listingId);
  if (!prev || prev.hostId !== hostId) return undefined;

  let nextSlug = prev.slug;
  if (patch.slug && patch.slug !== prev.slug) {
    slugToListingId.delete(prev.slug);
    nextSlug = patch.slug;
    slugToListingId.set(nextSlug, listingId);
  }

  const next: HostListingRecord = {
    ...prev,
    ...patch,
    id: prev.id,
    hostId: prev.hostId,
    slug: nextSlug,
    updatedAt: nowIso(),
  };
  listingsById.set(listingId, next);
  persistToDisk();
  return next;
}

export function deleteListing(listingId: string, hostId: string): boolean {
  const prev = listingsById.get(listingId);
  if (!prev || prev.hostId !== hostId) return false;
  listingsById.delete(listingId);
  slugToListingId.delete(prev.slug);
  persistToDisk();
  return true;
}

export function updateUser(
  userId: string,
  patch: Partial<Pick<UserRecord, "fullName" | "phone">>
): UserRecord | undefined {
  const u = usersById.get(userId);
  if (!u) return undefined;
  const next: UserRecord = { ...u, ...patch };
  usersById.set(userId, next);
  persistToDisk();
  return next;
}

export function setUserRole(userId: string, role: UserRole): UserRecord | undefined {
  const u = usersById.get(userId);
  if (!u) return undefined;
  const next: UserRecord = { ...u, role };
  usersById.set(userId, next);
  persistToDisk();
  return next;
}

/** Admin-only: returns all users sorted by createdAt desc. */
export function listAllUsers(): UserRecord[] {
  syncStoreFromDiskIfStale();
  return [...usersById.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** Admin-only: returns all listings sorted by updatedAt desc. */
export function listAllListings(): HostListingRecord[] {
  syncStoreFromDiskIfStale();
  return [...listingsById.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
