"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Caché en memoria para GET de la app: al volver a una pantalla se pinta al instante lo último que
 * se recibió y se pide lo nuevo en segundo plano.
 */
type Entry = { data?: unknown; error?: boolean };

export const GUEST_THREADS_URL = "/api/guest/messages";

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const subs = new Set<() => void>();
let owner: string | null = null;

const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

/** Lo guardado es de una sola cuenta: al cambiar de usuario se descarta. */
export function setCacheOwner(userId: string | null) {
  if (typeof window === "undefined" || userId === owner) return;
  owner = userId;
  store.clear();
  inflight.clear();
}

export function revalidate<T>(url: string): Promise<T | undefined> {
  const running = inflight.get(url);
  if (running) return running as Promise<T | undefined>;
  const p = fetch(url, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((data: T) => {
      store.set(url, { data });
      emit();
      return data;
    })
    .catch(() => {
      if (store.get(url)?.data === undefined) {
        store.set(url, { error: true });
        emit();
      }
      return undefined;
    })
    .finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

export function peekCached<T>(url: string): T | undefined {
  return store.get(url)?.data as T | undefined;
}

export function mutateCached<T>(url: string, update: (prev: T | undefined) => T | undefined) {
  store.set(url, { data: update(store.get(url)?.data as T | undefined) });
  emit();
}

export function prefetchCached(urls: string[]) {
  for (const u of urls) if (!store.has(u)) void revalidate(u);
}

export function useCached<T>(url: string | null): { data: T | undefined; error: boolean } {
  const entry = useSyncExternalStore(
    subscribe,
    () => (url ? store.get(url) : undefined),
    () => undefined
  );
  useEffect(() => {
    if (url) void revalidate(url);
  }, [url]);
  return { data: entry?.data as T | undefined, error: Boolean(entry?.error) };
}
