"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isAndroidAppShell } from "@/lib/app-shell";
import { CREDIT_CHECK_ENABLED } from "@/lib/feature-flags";

const noopSubscribe = () => () => {};
const clientAvailable = () => CREDIT_CHECK_ENABLED && !isAndroidAppShell();
const serverAvailable = () => false;

/** En el servidor y durante la hidratación da false, para que la app de Android nunca pinte la función. */
export function useCreditCheckAvailable(): boolean {
  return useSyncExternalStore(noopSubscribe, clientAvailable, serverAvailable);
}

export function CreditCheckGate({ children }: { children: React.ReactNode }) {
  return useCreditCheckAvailable() ? <>{children}</> : null;
}

/** Marca la sesión del TWA desde la primera página, aunque esa página no use el historial. */
export function AppShellMarker() {
  useEffect(() => {
    isAndroidAppShell();
  }, []);
  return null;
}
