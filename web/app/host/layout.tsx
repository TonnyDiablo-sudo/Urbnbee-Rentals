import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";

export default async function HostLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    const path = (await headers()).get("x-cabibee-path") ?? "/host/dashboard";
    const next = path.startsWith("/host") ? path : "/host/dashboard";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (user.role !== "host" && user.role !== "admin") {
    redirect("/register?intent=host");
  }
  if (user.mustChangePassword) redirect("/activar-cuenta");
  const t = await getT();

  return (
    <>
      <SiteHeader />
      <div className="flex min-h-screen flex-col lg:flex-row" style={{ paddingTop: 72 }}>
        <aside className="shrink-0 border-b border-[#ebebeb] bg-white lg:w-56 lg:border-b-0 lg:border-r">
          <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:sticky lg:top-[72px] lg:flex-col lg:gap-0 lg:p-4">
            <p className="hidden px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#aaa] lg:block">
              {user.role === "admin" ? t("Anfitrión (admin)") : t("Centro de anfitrión")}
            </p>
            <Link
              href="/host/dashboard"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              {t("Panel")}
            </Link>
            <Link
              href="/host/listings"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              {t("Mis alojamientos")}
            </Link>
            <Link
              href="/host/calendar"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              {t("Calendario")}
            </Link>
            <Link
              href="/host/estadisticas"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              {t("Estadísticas")}
            </Link>
            <Link
              href="/host/messages"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              {t("Mensajes")}
            </Link>
            <Link
              href="/host/requests"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              {t("Reservas")}
            </Link>
            <Link
              href="/host/herramientas"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              {t("Mis herramientas")}
            </Link>
            <Link
              href="/host/limpieza"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              {t("Limpieza")}
            </Link>
            <Link
              href="/host/colaboradores"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              {t("Colaboradores")}
            </Link>
            <Link
              href="/tienda"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-[#b8931a] hover:bg-amber-50 lg:rounded-lg lg:px-3"
            >
              {t("Tienda")}
            </Link>
            <Link
              href="/host/verificacion"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              {t("Verificación")}
            </Link>
            <Link
              href="/host/settings/pagos"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              {t("Pagos")}
            </Link>
            <Link
              href="/host/settings/integrations"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              {t("Integraciones")}
            </Link>
            {user.role === "admin" && (
              <Link
                href="/admin/overview"
                className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-[#b8931a] hover:bg-amber-50 lg:rounded-lg lg:px-3"
              >
                {t("Administración")}
              </Link>
            )}
            <Link
              href="/"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#888] hover:bg-[#f5f5f5] lg:rounded-lg lg:px-3"
            >
              {t("Ver sitio público")}
            </Link>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 bg-[#fafafa] px-4 py-8 sm:px-8">{children}</main>
      </div>
    </>
  );
}
