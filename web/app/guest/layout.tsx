import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { VerifyEmailBox } from "@/components/account/purchase-prereqs";
import { SiteHeader } from "@/components/site-header";
import { isPlaceholderEmail } from "@/lib/associate-provision";
import { CREDIT_CHECK_ENABLED } from "@/lib/feature-flags";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";

export default async function GuestLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    const path = (await headers()).get("x-cabibee-path") ?? "/guest";
    redirect(`/login?next=${encodeURIComponent(path.startsWith("/guest") ? path : "/guest")}`);
  }

  const t = await getT();
  const isGuest = user.role === "guest";

  return (
    <>
      <SiteHeader />
      <div className="flex min-h-screen flex-col lg:flex-row" style={{ paddingTop: 72 }}>
        <aside className="shrink-0 border-b border-[#ebebeb] bg-white lg:w-56 lg:border-b-0 lg:border-r">
          <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:sticky lg:top-[72px] lg:flex-col lg:gap-0 lg:p-4">
            <p className="hidden px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#aaa] lg:block">
              {t("Mi cuenta")}
            </p>
            <Link
              href="/guest"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              {t("Resumen")}
            </Link>
            <Link
              href="/guest/membresia"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              {t("Membresía")}
            </Link>
            <Link
              href="/guest/bookings"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              {t("Mis reservas")}
            </Link>
            <Link
              href="/guest/gastos"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              {t("Mis gastos")}
            </Link>
            {CREDIT_CHECK_ENABLED && (
              <Link
                href="/guest/screening"
                className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
              >
                {t("Screening")}
              </Link>
            )}
            <Link
              href="/guest/messages"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              {t("Mensajes")}
            </Link>
            {isGuest && (
              <Link
                href="/guest/profile"
                className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
              >
                {t("Perfil y foto")}
              </Link>
            )}
            <Link
              href="/guest/reportes"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              {t("Reportes y sugerencias")}
            </Link>
            {user.role === "admin" && (
              <Link
                href="/admin/overview"
                className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-[#b8931a] hover:bg-amber-50 lg:rounded-lg lg:px-3"
              >
                {t("Administración")}
              </Link>
            )}
            {(user.role === "host" || user.role === "admin") && (
              <Link
                href="/host/dashboard"
                className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#888] hover:bg-[#f5f5f5] lg:rounded-lg lg:px-3"
              >
                {t("Panel anfitrión")}
              </Link>
            )}
            <Link
              href="/"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#888] hover:bg-[#f5f5f5] lg:rounded-lg lg:px-3"
            >
              {t("Ver sitio")}
            </Link>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 bg-[#fafafa] px-4 py-8 sm:px-8">
          {!user.emailVerifiedAt && user.role !== "admin" && (
            <div className="mx-auto mb-6 max-w-3xl">
              <VerifyEmailBox email={user.email} placeholder={isPlaceholderEmail(user.email)} />
            </div>
          )}
          {children}
        </main>
      </div>
    </>
  );
}
