"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useT } from "@/components/i18n-provider";
import { mutateCached, peekCached, revalidate, useCached } from "./cached-fetch";
import { IconBell, IconInfo } from "./icons";

export const NOTIFICATIONS_URL = "/api/notifications";

export type AppNotification = {
  id: string;
  kind: "message" | "request" | "booking" | "payment" | "review" | "contract";
  title: string;
  body: string;
  vars?: Record<string, string | number>;
  rawBody?: boolean;
  url: string;
  createdAt: string;
  readAt?: string;
};

export type NotificationsData = { items: AppNotification[]; unread: number };

export function markNotificationsRead(ids?: string[]) {
  mutateCached<NotificationsData>(NOTIFICATIONS_URL, (prev) => {
    if (!prev) return prev;
    const only = ids ? new Set(ids) : null;
    const at = new Date().toISOString();
    const items = prev.items.map((n) => (!n.readAt && (!only || only.has(n.id)) ? { ...n, readAt: at } : n));
    return { items, unread: items.filter((n) => !n.readAt).length };
  });
  void fetch(NOTIFICATIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ids ? { ids } : {}),
  }).catch(() => {});
}

/**
 * Una sola consulta periódica para toda la app. Abrir la pantalla a la que lleva un aviso
 * (p. ej. el chat) lo marca como leído.
 */
export function useNotificationsSync(enabled: boolean) {
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === "visible") void revalidate(NOTIFICATIONS_URL);
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled]);

  const data = useCached<NotificationsData>(enabled ? NOTIFICATIONS_URL : null).data;
  useEffect(() => {
    if (!enabled) return;
    const items = peekCached<NotificationsData>(NOTIFICATIONS_URL)?.items ?? [];
    const here = items.filter((n) => !n.readAt && n.url === pathname).map((n) => n.id);
    if (here.length) markNotificationsRead(here);
  }, [enabled, pathname, data]);
}

/** Lleva a «Qué es Cabibee y cómo funciona»; va junto a la campana. */
export function InfoButton({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <Link
      href="/como-funciona"
      prefetch
      className={`flex h-9 shrink-0 touch-manipulation items-center gap-1 whitespace-nowrap rounded-full bg-[#dcb81e] pl-2 pr-3 text-[13px] font-semibold text-black shadow-sm hover:bg-[#c9a714] ${className}`}
      aria-label={t("Qué es Cabibee y cómo funciona")}
    >
      <IconInfo className="h-[18px] w-[18px]" />
      <span className="hidden min-[390px]:inline">{t("¿Qué es Cabibee?")}</span>
    </Link>
  );
}

export function NotificationBell({ className = "" }: { className?: string }) {
  const t = useT();
  const { data, error } = useCached<NotificationsData>(NOTIFICATIONS_URL);
  if (error || !data) return null;
  const n = data.unread;
  return (
    <Link
      href="/notificaciones"
      prefetch
      className={`relative flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full text-[#222] hover:bg-[#f5f5f5] ${className}`}
      aria-label={n > 0 ? t("Notificaciones ({n} sin leer)", { n }) : t("Notificaciones")}
    >
      <IconBell />
      {n > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#e0452b] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
          {n > 9 ? "9+" : n}
        </span>
      )}
    </Link>
  );
}
