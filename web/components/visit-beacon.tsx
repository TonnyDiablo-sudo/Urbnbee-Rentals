"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const SKIP = /^\/(admin|asociados)(\/|$)/;

/** Cuenta una página vista por navegación para las estadísticas de la plataforma. */
export function VisitBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || SKIP.test(pathname)) return;
    try {
      if (!navigator.sendBeacon?.("/api/track/visit")) {
        void fetch("/api/track/visit", { method: "POST", keepalive: true, credentials: "same-origin" });
      }
    } catch {
      /* sin estadística, sin drama */
    }
  }, [pathname]);
  return null;
}
