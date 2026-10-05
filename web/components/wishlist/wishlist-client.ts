"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { WishlistSummary } from "@/lib/wishlist-view";

export type WishlistState = {
  status: "idle" | "loading" | "anon" | "ready";
  lists: WishlistSummary[];
  /** Crear listas pide el correo confirmado. */
  emailConfirmed?: boolean;
  email?: string;
  placeholderEmail?: boolean;
};

const IDLE: WishlistState = { status: "idle", lists: [] };
let state: WishlistState = IDLE;
let inflight: Promise<WishlistState> | null = null;
const listeners = new Set<() => void>();

function emit(next: WishlistState) {
  state = next;
  for (const l of listeners) l();
}

export function loadWishlists(force = false): Promise<WishlistState> {
  if (!force && state.status !== "idle") return inflight ?? Promise.resolve(state);
  if (state.status === "idle") emit({ ...state, status: "loading" });
  inflight = fetch("/api/wishlists", { credentials: "include", cache: "no-store" })
    .then(async (r) => {
      if (r.status === 401) return { status: "anon", lists: [] } as WishlistState;
      const d = (await r.json()) as Omit<WishlistState, "status">;
      return {
        status: "ready",
        lists: d.lists ?? [],
        emailConfirmed: d.emailConfirmed !== false,
        email: d.email,
        placeholderEmail: d.placeholderEmail,
      } as WishlistState;
    })
    .catch(() => ({ ...state, status: "ready" }) as WishlistState)
    .then((s) => {
      inflight = null;
      emit(s);
      return s;
    });
  return inflight;
}

/** Reemplaza (o agrega al principio) una lista que devolvió el servidor. */
export function putWishlist(list: WishlistSummary) {
  const exists = state.lists.some((l) => l.id === list.id);
  emit({
    ...state,
    status: "ready",
    lists: exists ? state.lists.map((l) => (l.id === list.id ? list : l)) : [list, ...state.lists],
  });
}

export function dropWishlist(id: string) {
  emit({ ...state, lists: state.lists.filter((l) => l.id !== id) });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useWishlists(): WishlistState {
  const s = useSyncExternalStore(subscribe, () => state, () => IDLE);
  useEffect(() => {
    void loadWishlists();
  }, []);
  return s;
}

export function isSavedAnywhere(s: WishlistState, slug: string): boolean {
  return s.lists.some((l) => l.slugs.includes(slug));
}

export async function patchWishlist(id: string, body: Record<string, unknown>) {
  const r = await fetch(`/api/wishlists/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = (await r.json().catch(() => ({}))) as { list?: WishlistSummary; token?: string; error?: string };
  if (!r.ok) throw new Error(d.error ?? "Error");
  if (d.list) putWishlist(d.list);
  return d;
}

export async function createWishlistClient(body: { name: string; slug?: string; checkIn?: string; checkOut?: string }) {
  const r = await fetch("/api/wishlists", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = (await r.json().catch(() => ({}))) as { list?: WishlistSummary; error?: string };
  if (!r.ok || !d.list) throw new Error(d.error ?? "Error");
  putWishlist(d.list);
  return d.list;
}
