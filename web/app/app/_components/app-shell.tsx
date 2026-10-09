"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useT } from "@/components/i18n-provider";
import {
  IconBag,
  IconBroom,
  IconCalendar,
  IconChart,
  IconChat,
  IconHeart,
  IconHome,
  IconMenu,
  IconSearch,
  IconToday,
  IconTrips,
  IconUser,
} from "./icons";
import { prefetchHostData } from "../host/_shared/host-data";
import { GUEST_THREADS_URL, prefetchCached, setCacheOwner } from "./cached-fetch";
import { useNotificationsSync } from "./notifications";
import { threadIsUnread } from "./seen";
import { PushPrompt } from "./push";
import { UpdateBanner } from "./update-banner";

export type AppUser = { id: string; fullName: string; email: string; role: "guest" | "host" | "admin" } | null;

type Tab = { href: string; label: string; icon: React.ReactNode; badge?: boolean };

/** Pantallas de detalle a pantalla completa: sin barra inferior, como en Airbnb. */
const FULLSCREEN = [
  /^\/alojamiento\//,
  /^\/mensajes\/.+/,
  /^\/host\/mensajes\/.+/,
  /^\/host\/anuncios\/.+/,
  /^\/cuenta\//,
  /^\/notificaciones/,
  // Tienen su propia barra fija de "Guardar" abajo: con la de pestañas encima no se veía.
  /^\/host\/contratos/,
  /^\/perfil\/editar/,
  /^\/contrato\//,
];

/** Pantallas compartidas por ambos modos: abrirlas no cambia el modo guardado. */
const NEUTRAL = [/^\/notificaciones/, /^\/tienda/, /^\/equipo/, /^\/cuenta\//, /^\/contrato\//, /^\/persona\//];

const noSubscribe = () => () => {};
const savedHostMode = () => /(?:^|;\s*)cabibee_mode=host/.test(document.cookie);

export function AppShell({ user, children }: { user: AppUser; children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname() ?? "/";
  const isHost = user?.role === "host" || user?.role === "admin";
  // Sin cuenta de anfitrión, /host es sólo la invitación: se conserva la navegación de huésped.
  const neutral = NEUTRAL.some((r) => r.test(pathname));
  const lastWasHost = useSyncExternalStore(noSubscribe, savedHostMode, () => false);
  const hostMode = isHost && (neutral ? lastWasHost : pathname === "/host" || pathname.startsWith("/host/"));
  setCacheOwner(user?.id ?? null);
  const unread = useUnreadCount(hostMode ? "host" : "guest", user);
  useNotificationsSync(Boolean(user));

  useEffect(() => {
    if (user) prefetchCached([GUEST_THREADS_URL]);
  }, [user]);

  useEffect(() => {
    if (!isHost) return;
    if (hostMode) {
      prefetchHostData();
      return;
    }
    const id = window.setTimeout(prefetchHostData, 2500);
    return () => window.clearTimeout(id);
  }, [isHost, hostMode]);

  useEffect(() => {
    if (neutral) return;
    document.cookie = `cabibee_mode=${hostMode ? "host" : "guest"}; path=/; max-age=31536000; samesite=lax`;
  }, [hostMode, neutral]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);

  const tabs: Tab[] = hostMode
    ? [
        { href: "/host", label: t("Hoy"), icon: <IconToday /> },
        { href: "/host/calendario", label: t("Calendario"), icon: <IconCalendar /> },
        { href: "/host/anuncios", label: t("Anuncios"), icon: <IconHome /> },
        { href: "/host/estadisticas", label: t("Métricas"), icon: <IconChart /> },
        { href: "/host/limpieza", label: t("Limpieza"), icon: <IconBroom /> },
        { href: "/host/mensajes", label: t("Mensajes"), icon: <IconChat />, badge: unread > 0 },
        { href: "/tienda", label: t("Tienda"), icon: <IconBag /> },
        { href: "/host/menu", label: t("Menú"), icon: <IconMenu /> },
      ]
    : [
        { href: "/", label: t("Explorar"), icon: <IconSearch /> },
        { href: "/favoritos", label: t("Favoritos"), icon: <IconHeart /> },
        { href: "/viajes", label: t("Viajes"), icon: <IconTrips /> },
        { href: "/mensajes", label: t("Mensajes"), icon: <IconChat />, badge: unread > 0 },
        ...(user ? [{ href: "/tienda", label: t("Tienda"), icon: <IconBag /> }] : []),
        { href: "/perfil", label: user ? t("Perfil") : t("Iniciar sesión"), icon: <IconUser /> },
      ];

  const fullscreen = FULLSCREEN.some((r) => r.test(pathname));

  return (
    <div className="flex min-h-dvh flex-col bg-[#f7f7f7]">
      <UpdateBanner />
      <div
        className={`mx-auto flex w-full flex-1 flex-col bg-white md:shadow-[0_0_0_1px_#ececec] ${
          fullscreen ? "max-w-xl md:max-w-3xl" : "max-w-xl md:max-w-3xl lg:max-w-5xl pb-[calc(64px+env(safe-area-inset-bottom))]"
        }`}
      >
        {children}
      </div>
      {user && !fullscreen && <PushPrompt />}
      {!fullscreen && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[#ebebeb] bg-white"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          aria-label={hostMode ? t("Navegación de anfitrión") : t("Navegación principal")}
        >
          <div className="mx-auto flex h-16 max-w-xl items-stretch justify-around md:max-w-3xl">
            {tabs.map((tab) => {
              const active =
                tab.href === "/" || tab.href === "/host"
                  ? pathname === tab.href
                  : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  prefetch
                  className={`relative flex min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 font-medium ${
                    tabs.length > 6 ? "text-[9.5px] tracking-tight" : "text-[11px]"
                  }`}
                >
                  <TabContent tab={tab} active={active} compact={tabs.length > 6} />
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

/** Se pinta como activa en cuanto se toca, sin esperar a que llegue la pantalla. */
function TabContent({ tab, active, compact }: { tab: Tab; active: boolean; compact: boolean }) {
  const { pending } = useLinkStatus();
  const on = active || pending;
  return (
    <>
      <span className={`${on ? "text-[#dcb81e]" : "text-[#9a9a9a]"} ${compact ? "[&>svg]:h-[22px] [&>svg]:w-[22px]" : ""}`}>
        {tab.icon}
      </span>
      <span className={`max-w-full truncate px-0.5 ${on ? "text-black" : "text-[#9a9a9a]"}`}>{tab.label}</span>
      {tab.badge && (
        <span className="absolute right-[calc(50%-18px)] top-2 h-2.5 w-2.5 rounded-full bg-[#e0452b] ring-2 ring-white" />
      )}
    </>
  );
}

type HostThread = { listingId: string; guestSessionId: string; lastAt: string; messages: { sender: string }[] };
type GuestThread = { listingId: string; lastAt: string; lastSender?: string };

function useUnreadCount(mode: "host" | "guest", user: AppUser): number {
  const [count, setCount] = useState(0);
  const isHost = user?.role === "host" || user?.role === "admin";

  useEffect(() => {
    if (!user || (mode === "host" && !isHost)) {
      setCount(0);
      return;
    }
    let cancelled = false;
    let last: HostThread[] | GuestThread[] = [];

    const evaluate = () => {
      const n =
        mode === "host"
          ? (last as HostThread[]).filter(
              (t) =>
                t.messages[t.messages.length - 1]?.sender === "guest" &&
                threadIsUnread(`h:${t.listingId}:${t.guestSessionId}`, t.lastAt)
            ).length
          : (last as GuestThread[]).filter(
              (t) => t.lastSender === "host" && threadIsUnread(`g:${t.listingId}`, t.lastAt)
            ).length;
      if (!cancelled) setCount(n);
    };

    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(mode === "host" ? "/api/host/inbox" : "/api/guest/messages", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        last = Array.isArray(data.threads) ? data.threads : [];
        evaluate();
      } catch {
        /* sin red: se reintenta en la próxima vuelta */
      }
    };

    void load();
    const timer = window.setInterval(load, 30_000);
    window.addEventListener("cabibee:seen", evaluate);
    document.addEventListener("visibilitychange", load);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("cabibee:seen", evaluate);
      document.removeEventListener("visibilitychange", load);
    };
  }, [mode, user, isHost]);

  return count;
}
