"use client";

import { useCallback, useEffect, useState } from "react";

export type PushState =
  | "loading"
  | "unsupported"
  | "ios-install"
  | "unavailable"
  | "denied"
  | "off"
  | "on";

const DISMISS_KEY = "cabibee_push_prompt_dismissed";

function base64UrlToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Quita la suscripción de este dispositivo (p. ej. al cerrar sesión en un equipo compartido). */
export async function unsubscribeThisDevice(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push/subscription", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe();
  } catch {
    /* ignore */
  }
}

export function usePush() {
  const [state, setState] = useState<PushState>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
      return;
    }
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      const q = sub ? `?endpoint=${encodeURIComponent(sub.endpoint)}` : "";
      const res = await fetch(`/api/push/subscription${q}`, { cache: "no-store" });
      const data = (await res.json()) as { configured: boolean; publicKey: string | null; subscribed: boolean };
      setPublicKey(data.publicKey);
      if (!data.configured || !data.publicKey) setState("unavailable");
      else if (Notification.permission === "denied") setState("denied");
      else setState(sub && data.subscribed ? "on" : "off");
    } catch {
      setState("unavailable");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await registration();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) });
      }
      const res = await fetch("/api/push/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error);
      setState("on");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "No se pudieron activar los avisos.");
    } finally {
      setBusy(false);
    }
  }, [publicKey]);

  const disable = useCallback(async () => {
    setBusy(true);
    await unsubscribeThisDevice();
    setBusy(false);
    setState("off");
  }, []);

  return { state, busy, error, enable, disable };
}

const HINT: Record<PushState, string> = {
  loading: "",
  unsupported: "Este navegador no permite avisos.",
  "ios-install": "En iPhone, primero agrega Cabibee a tu pantalla de inicio.",
  unavailable: "Todavía no están disponibles.",
  denied: "Bloqueados. Actívalos en los ajustes del navegador.",
  off: "Mensajes nuevos y reservas, aunque la app esté cerrada.",
  on: "Activados en este dispositivo.",
};

/** Renglón para Perfil / Menú. */
export function PushToggle() {
  const { state, busy, error, enable, disable } = usePush();
  if (state === "loading") return null;
  const actionable = state === "on" || state === "off";
  return (
    <li className="flex items-center gap-3 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] text-[#222]">Notificaciones</p>
        <p className="text-xs text-[#888]">{error ?? HINT[state]}</p>
      </div>
      {actionable && (
        <button
          type="button"
          role="switch"
          aria-checked={state === "on"}
          aria-label="Notificaciones"
          disabled={busy}
          onClick={() => void (state === "on" ? disable() : enable())}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
            state === "on" ? "bg-[#dcb81e]" : "bg-[#ddd]"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
              state === "on" ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      )}
    </li>
  );
}

/** Tarjeta para "Hoy" del anfitrión: sólo aparece si puede activarlos y no la ha descartado. */
export function PushPrompt() {
  const { state, busy, error, enable } = usePush();
  const [dismissed, setDismissed] = useState(false);

  // "off" sólo se alcanza en el cliente, así que aquí ya existe localStorage.
  if (state !== "off" || dismissed || localStorage.getItem(DISMISS_KEY) === "1") return null;
  return (
    <div className="rounded-2xl border border-[#f1e4a6] bg-[#fffbea] p-4">
      <p className="text-[15px] font-semibold text-[#222]">Entérate al momento</p>
      <p className="mt-1 text-sm text-[#555]">
        Te avisamos cuando un huésped te escriba o te llegue una solicitud, aunque tengas la app cerrada.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void enable()}
          className="rounded-xl bg-[#111] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Activando…" : "Activar avisos"}
        </button>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
          className="rounded-xl px-4 py-2.5 text-sm font-medium text-[#717171]"
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
