import Link from "next/link";
import type { UserRecord } from "@/lib/marketplace-types";
import { IconChevron, IconExternal, IconSwitch } from "./icons";
import { LogoutButton } from "./logout-button";
import { PushToggle } from "./push";
import { WebLink } from "./site-origin";
import { TabHeader } from "./top-bar";

type Item = { href: string; label: string; hint?: string; web?: boolean };

function ItemText({ item }: { item: Item }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[15px] text-[#222]">{item.label}</p>
      {item.hint && <p className="text-xs text-[#888]">{item.hint}</p>}
    </div>
  );
}

/** Perfil (modo huésped) y Menú (modo anfitrión): misma cuenta, distinto contexto. */
export function ProfileView({ user, mode }: { user: UserRecord | null; mode: "guest" | "host" }) {
  const isHost = user?.role === "host" || user?.role === "admin";

  const items: Item[] =
    mode === "host"
      ? [
          { href: "/host/motor", label: "Motor de reservas", hint: "Membresía e identidad de anfitrión" },
          { href: "/host/anuncios", label: "Mis anuncios" },
          { href: "/host/calendar", label: "Calendario y precios por fecha", web: true },
          { href: "/host/requests", label: "Contratos, depósitos y reseñas", web: true },
          { href: "/host/settings/pagos", label: "Pagos de la estancia (tu Stripe)", web: true },
          { href: "/host/settings/integrations", label: "BeeAgent e integraciones", web: true },
          { href: "/host/dashboard", label: "Panel completo de anfitrión", web: true },
        ]
      : [
          { href: "/membresia", label: "Membresía de huésped", hint: "Identidad verificada para reservar" },
          { href: "/viajes", label: "Mis viajes" },
          ...(user ? [{ href: "/guest/profile", label: "Datos personales y foto", web: true }] : []),
          { href: "/", label: "Sitio web de Cabibee", web: true },
        ];

  return (
    <>
      <TabHeader title={mode === "host" ? "Menú" : "Perfil"} />
      <div className="px-5 pb-8">
        {user ? (
          <div className="flex items-center gap-4 border-b border-[#ebebeb] pb-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#111] text-xl font-bold text-[#dcb81e]">
              {(user.fullName || user.email).trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-[#222]">{user.fullName || "Tu cuenta"}</p>
              <p className="truncate text-sm text-[#717171]">{user.email}</p>
            </div>
          </div>
        ) : (
          <div className="border-b border-[#ebebeb] pb-6">
            <p className="text-[15px] leading-relaxed text-[#555]">
              Explora sin cuenta. Crea una gratis cuando quieras ver contactos, chatear o reservar.
            </p>
            <div className="mt-4 flex gap-3">
              <Link
                href="/cuenta/registro?next=/perfil"
                className="flex-1 rounded-xl bg-[#dcb81e] py-3 text-center text-[15px] font-semibold text-black"
              >
                Crear cuenta
              </Link>
              <Link
                href="/cuenta/entrar?next=/perfil"
                className="flex-1 rounded-xl border border-[#222] py-3 text-center text-[15px] font-semibold text-[#222]"
              >
                Entrar
              </Link>
            </div>
          </div>
        )}

        <Link
          href={mode === "host" ? "/" : "/host"}
          className="mt-5 flex items-center gap-4 rounded-2xl bg-[#111] p-4 text-white shadow-[0_6px_20px_rgba(0,0,0,0.15)]"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">
              {mode === "host" ? "Cambiar a modo huésped" : isHost ? "Cambiar a modo anfitrión" : "Hazte anfitrión"}
            </p>
            <p className="mt-0.5 text-sm text-white/70">
              {mode === "host"
                ? "Busca alojamientos y reserva con la misma cuenta."
                : isHost
                  ? "Tus mensajes, solicitudes y anuncios."
                  : "Publica tu espacio gratis y recibe mensajes."}
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dcb81e] text-black">
            <IconSwitch />
          </span>
        </Link>

        <ul className="mt-5 divide-y divide-[#f0f0f0]">
          {user && <PushToggle />}
          {items.map((i) => (
            <li key={i.href}>
              {i.web ? (
                <WebLink path={i.href} className="flex items-center gap-3 py-4">
                  <ItemText item={i} />
                  <span className="flex items-center gap-1 text-xs text-[#999]">
                    web <IconExternal />
                  </span>
                </WebLink>
              ) : (
                <Link href={i.href} className="flex items-center gap-3 py-4">
                  <ItemText item={i} />
                  <IconChevron className="h-5 w-5 text-[#999]" />
                </Link>
              )}
            </li>
          ))}
        </ul>

        {user && <LogoutButton />}
        <p className="mt-8 text-center text-xs text-[#aaa]">Cabibee · Your Booking Bee</p>
      </div>
    </>
  );
}
