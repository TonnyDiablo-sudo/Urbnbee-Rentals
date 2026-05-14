import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/session";

export default async function GuestLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=/guest");
  }

  const isGuest = user.role === "guest";

  return (
    <>
      <SiteHeader />
      <div className="flex min-h-screen flex-col lg:flex-row" style={{ paddingTop: 72 }}>
        <aside className="shrink-0 border-b border-[#ebebeb] bg-white lg:w-56 lg:border-b-0 lg:border-r">
          <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:sticky lg:top-[72px] lg:flex-col lg:gap-0 lg:p-4">
            <p className="hidden px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#aaa] lg:block">
              Mi cuenta
            </p>
            <Link
              href="/guest"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              Resumen
            </Link>
            <Link
              href="/guest/membresia"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              Membresía
            </Link>
            <Link
              href="/guest/bookings"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              Mis reservas
            </Link>
            <Link
              href="/guest/messages"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
            >
              Mensajes
            </Link>
            {isGuest && (
              <Link
                href="/guest/profile"
                className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#484848] hover:bg-black hover:text-white lg:rounded-lg lg:px-3"
              >
                Perfil y foto
              </Link>
            )}
            {user.role === "admin" && (
              <Link
                href="/admin/overview"
                className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-[#b8931a] hover:bg-amber-50 lg:rounded-lg lg:px-3"
              >
                Administración
              </Link>
            )}
            {(user.role === "host" || user.role === "admin") && (
              <Link
                href="/host/dashboard"
                className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#888] hover:bg-[#f5f5f5] lg:rounded-lg lg:px-3"
              >
                Panel anfitrión
              </Link>
            )}
            <Link
              href="/"
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-[#888] hover:bg-[#f5f5f5] lg:rounded-lg lg:px-3"
            >
              Ver sitio
            </Link>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 bg-[#fafafa] px-4 py-8 sm:px-8">{children}</main>
      </div>
    </>
  );
}
