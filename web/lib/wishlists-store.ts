import "server-only";
import { randomBytes } from "crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

export type WishlistItem = { slug: string; addedBy: string; addedAt: string };

/** Lista de favoritos o viaje: la crea una persona y la comparte con un enlace. */
export type Wishlist = {
  id: string;
  ownerId: string;
  name: string;
  checkIn?: string;
  checkOut?: string;
  items: WishlistItem[];
  /** Quienes entraron con el enlace: ven la lista y pueden agregar o quitar alojamientos. */
  memberIds: string[];
  /** Se crea al compartir por primera vez. */
  shareToken?: string;
  createdAt: string;
  updatedAt: string;
};

export const WISHLIST_NAME_MAX = 60;
const MAX_LISTS_PER_USER = 50;
const MAX_ITEMS = 200;
const MAX_MEMBERS = 20;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const DATA_FILE = join(getDataDir(), "wishlists.json");
let lists: Wishlist[] = [];
let cachedMtimeMs = 0;

function load() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { lists?: Wishlist[] };
    lists = Array.isArray(data.lists) ? data.lists : [];
    cachedMtimeMs = m;
  } catch (e) {
    console.warn("[wishlists] load failed:", e);
  }
}

function persist() {
  try {
    ensureDir(getDataDir());
    const snapshot = { version: 1 as const, lists };
    writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("wishlists", snapshot));
  } catch (e) {
    console.warn("[wishlists] persist failed:", e);
  }
}

load();

export class WishlistError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

function cleanName(raw: unknown): string {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, WISHLIST_NAME_MAX);
  if (!name) throw new WishlistError("Ponle un nombre a la lista.");
  return name;
}

function cleanDates(checkIn: unknown, checkOut: unknown): { checkIn?: string; checkOut?: string } {
  const a = typeof checkIn === "string" && DAY.test(checkIn) ? checkIn : undefined;
  const b = typeof checkOut === "string" && DAY.test(checkOut) ? checkOut : undefined;
  if (a && b && b <= a) throw new WishlistError("La salida tiene que ser después de la llegada.");
  return { checkIn: a, checkOut: b };
}

export function canEditWishlist(list: Wishlist, userId: string): boolean {
  return list.ownerId === userId || list.memberIds.includes(userId);
}

export function listWishlistsForUser(userId: string): Wishlist[] {
  load();
  return lists
    .filter((l) => canEditWishlist(l, userId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getWishlist(id: string): Wishlist | undefined {
  load();
  return lists.find((l) => l.id === id);
}

export function getWishlistByToken(token: string): Wishlist | undefined {
  load();
  if (!token) return undefined;
  return lists.find((l) => l.shareToken === token);
}

function editable(id: string, userId: string): Wishlist {
  const list = getWishlist(id);
  if (!list || !canEditWishlist(list, userId)) throw new WishlistError("No encontramos esa lista.", 404);
  return list;
}

export function createWishlist(
  userId: string,
  input: { name: unknown; checkIn?: unknown; checkOut?: unknown }
): Wishlist {
  load();
  if (lists.filter((l) => l.ownerId === userId).length >= MAX_LISTS_PER_USER) {
    throw new WishlistError("Llegaste al máximo de listas. Borra alguna para crear otra.");
  }
  const now = new Date().toISOString();
  const list: Wishlist = {
    id: `wl_${randomBytes(8).toString("hex")}`,
    ownerId: userId,
    name: cleanName(input.name),
    ...cleanDates(input.checkIn, input.checkOut),
    items: [],
    memberIds: [],
    createdAt: now,
    updatedAt: now,
  };
  lists.push(list);
  persist();
  return list;
}

export function updateWishlist(
  id: string,
  userId: string,
  patch: { name?: unknown; checkIn?: unknown; checkOut?: unknown }
): Wishlist {
  const list = editable(id, userId);
  if (patch.name !== undefined) list.name = cleanName(patch.name);
  if (patch.checkIn !== undefined || patch.checkOut !== undefined) {
    const d = cleanDates(
      patch.checkIn !== undefined ? patch.checkIn : list.checkIn,
      patch.checkOut !== undefined ? patch.checkOut : list.checkOut
    );
    list.checkIn = d.checkIn;
    list.checkOut = d.checkOut;
  }
  list.updatedAt = new Date().toISOString();
  persist();
  return list;
}

/** La dueña borra la lista; quien la recibió sólo se sale. */
export function deleteOrLeaveWishlist(id: string, userId: string): "deleted" | "left" {
  const list = editable(id, userId);
  if (list.ownerId === userId) {
    lists = lists.filter((l) => l.id !== id);
    persist();
    return "deleted";
  }
  list.memberIds = list.memberIds.filter((m) => m !== userId);
  list.updatedAt = new Date().toISOString();
  persist();
  return "left";
}

export function setWishlistItem(id: string, userId: string, slug: string, saved: boolean): Wishlist {
  const list = editable(id, userId);
  const has = list.items.some((i) => i.slug === slug);
  if (saved && !has) {
    if (list.items.length >= MAX_ITEMS) throw new WishlistError("La lista ya está llena.");
    list.items.unshift({ slug, addedBy: userId, addedAt: new Date().toISOString() });
  } else if (!saved && has) {
    list.items = list.items.filter((i) => i.slug !== slug);
  } else {
    return list;
  }
  list.updatedAt = new Date().toISOString();
  persist();
  return list;
}

export function ensureShareToken(id: string, userId: string): string {
  const list = editable(id, userId);
  if (!list.shareToken) {
    list.shareToken = randomBytes(12).toString("base64url");
    persist();
  }
  return list.shareToken;
}

/** Quien abre el enlace con su cuenta entra a la lista (si ya estaba, no pasa nada). */
export function joinWishlistByToken(token: string, userId: string): Wishlist | undefined {
  const list = getWishlistByToken(token);
  if (!list) return undefined;
  if (canEditWishlist(list, userId)) return list;
  if (list.memberIds.length >= MAX_MEMBERS) throw new WishlistError("Este viaje ya tiene el máximo de invitados.");
  list.memberIds.push(userId);
  list.updatedAt = new Date().toISOString();
  persist();
  return list;
}

export function removeWishlistMember(id: string, ownerId: string, memberId: string): Wishlist {
  const list = getWishlist(id);
  if (!list || list.ownerId !== ownerId) throw new WishlistError("Sólo quien creó la lista puede quitar invitados.", 403);
  list.memberIds = list.memberIds.filter((m) => m !== memberId);
  list.updatedAt = new Date().toISOString();
  persist();
  return list;
}

/** Deja de compartir: el enlace viejo ya no sirve y los invitados salen. */
export function resetWishlistSharing(id: string, ownerId: string): Wishlist {
  const list = getWishlist(id);
  if (!list || list.ownerId !== ownerId) throw new WishlistError("Sólo quien creó la lista puede dejar de compartirla.", 403);
  list.shareToken = undefined;
  list.memberIds = [];
  list.updatedAt = new Date().toISOString();
  persist();
  return list;
}
