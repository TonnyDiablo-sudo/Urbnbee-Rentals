"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Preferencia "traducir lo que me escriben" por conversación, guardada en localStorage.
 * Apagada = "0"; cualquier otra cosa (o nada) = encendida.
 */
const KEY = (k: string) => `cb:translate-in:${k}`;
const EVENT = "cb:translate-in";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function useTranslateInFlag(key: string): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(KEY(key)) !== "0";
      } catch {
        return true;
      }
    },
    () => true,
  );
  const set = useCallback(
    (next: boolean) => {
      try {
        if (next) window.localStorage.removeItem(KEY(key));
        else window.localStorage.setItem(KEY(key), "0");
      } catch {
        /* sin almacenamiento */
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [on, set];
}
