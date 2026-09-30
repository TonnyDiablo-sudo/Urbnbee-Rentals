import Link from "next/link";
import { LangSwitch } from "@/components/lang-switch";
import { getT } from "@/lib/i18n/server";
import { getHostProfile } from "@/lib/marketplace-store";
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
export async function ProfileView({ user, mode }: { user: UserRecord | null; mode: "guest" | "host" }) {
  const t = await getT();
  const isHost = user?.role === "host" || user?.role === "admin";
  const avatarUrl = user ? getHostProfile(user.id)?.avatarUrl : undefined;

  const items: Item[] =
    mode === "host"
      ? [
          { href: "/host/motor", label: t("Reservas en línea"), hint: t("Membresía e identidad de anfitrión") },
          { href: "/host/anuncios", label: t("Mis anuncios") },
          { href: "/host/contratos", label: t("Contratos"), hint: t("Machotes, tus datos y cláusulas por anuncio") },
          { href: "/host/calendar", label: t("Calendario y precios por fecha"), web: true },
          { href: "/host/requests", label: t("Depósitos y reseñas de huéspedes"), web: true },
          { href: "/host/settings/pagos", label: t("Pagos de la estancia (tu Stripe)"), web: true },
          { href: "/host/settings/integrations", label: t("BeeAgent e integraciones"), web: true },
          { href: "/host/dashboard", label: t("Panel completo de anfitrión"), web: true },
        ]
      : [
          { href: "/membresia", label: t("Membresía de huésped"), hint: t("Identidad verificada para reservar") },
          { href: "/viajes", label: t("Mis viajes") },
          ...(user ? [{ href: "/perfil/editar", label: t("Datos personales y foto") }] : []),
          { href: "/", label: t("Sitio web de Cabibee"), web: true },
        ];

  return (
    <>
      <TabHeader title={mode === "host" ? t("Menú") : t("Perfil")} right={<LangSwitch className="mt-2" />} />
      <div className="px-5 pb-8">
        {user ? (
          <Link
            href={mode === "host" ? "/perfil/editar?from=host" : "/perfil/editar"}
            className="flex items-center gap-4 border-b border-[#ebebeb] pb-5"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#111] text-2xl font-bold text-[#dcb81e]">
                {(user.fullName || user.email).trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold text-[#222]">{user.fullName || t("Tu cuenta")}</p>
              <p className="truncate text-sm text-[#717171]">{t("Editar perfil y foto")}</p>
            </div>
            <IconChevron className="h-5 w-5 shrink-0 text-[#999]" />
          </Link>
        ) : (
          <div className="border-b border-[#ebebeb] pb-6">
            <p className="text-[15px] leading-relaxed text-[#555]">
              {t("Explora sin cuenta. Crea una gratis cuando quieras ver contactos, chatear o reservar.")}
            </p>
            <div className="mt-4 flex gap-3">
              <Link
                href="/cuenta/registro?next=/perfil"
                className="flex-1 touch-manipulation rounded-xl bg-[#dcb81e] py-3 text-center text-[15px] font-semibold text-black"
              >
                {t("Crear cuenta")}
              </Link>
              <Link
                href="/cuenta/entrar?next=/perfil"
                className="flex-1 touch-manipulation rounded-xl border border-[#222] py-3 text-center text-[15px] font-semibold text-[#222]"
              >
                {t("Iniciar sesión")}
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
              {mode === "host"
                ? t("Cambiar a modo huésped")
                : isHost
                  ? t("Cambiar a modo anfitrión")
                  : t("Hazte anfitrión")}
            </p>
            <p className="mt-0.5 text-sm text-white/70">
              {mode === "host"
                ? t("Busca alojamientos y reserva con la misma cuenta.")
                : isHost
                  ? t("Tus mensajes, solicitudes y anuncios.")
                  : t("Publica tu espacio gratis y recibe mensajes.")}
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
