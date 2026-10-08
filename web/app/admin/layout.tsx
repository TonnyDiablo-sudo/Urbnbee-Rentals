import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { LangSwitch } from "@/components/lang-switch";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { listUserReports } from "@/lib/user-reports-store";
import { listAddressProofs } from "@/lib/address-proof-store";
import { listClaimRequests } from "@/lib/listing-claims-store";

const NAV = [
  { href: "/admin/overview", label: "Resumen", icon: "📊" },
  { href: "/admin/estadisticas", label: "Estadísticas", icon: "📈" },
  { href: "/admin/users", label: "Usuarios", icon: "👥" },
  { href: "/admin/asociados", label: "Asociados", icon: "🤝" },
  { href: "/admin/reportes", label: "Reportes y sugerencias", icon: "🚩" },
  { href: "/admin/resenas", label: "Reseñas", icon: "⭐" },
  { href: "/admin/correo", label: "Correo", icon: "✉️" },
  { href: "/admin/pricing", label: "Precios", icon: "💲" },
  { href: "/admin/promociones", label: "Promociones", icon: "🏷️" },
  { href: "/admin/pruebas", label: "Pruebas gratis", icon: "🎁" },
  { href: "/admin/notificaciones", label: "Notificaciones push", icon: "🔔" },
  { href: "/admin/blog-bot", label: "Blog (LLM)", icon: "✍️" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    redirect("/login");
  }
  const t = await getT();
  const pendingReports = listUserReports().filter((r) => r.status === "open" || r.status === "in_review").length;
  const pendingReview =
    listAddressProofs().filter((p) => p.status === "review").length + listClaimRequests().filter((c) => c.status === "open").length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-lg">🐝</span>
            <p className="text-sm font-bold text-amber-600">Cabibee · Admin</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <LangSwitch />
            <Link href="/host/dashboard" className="text-amber-700">
              {t("Anfitrión")}
            </Link>
            <Link href="/" className="text-gray-500">
              {t("← Sitio")}
            </Link>
            <AdminLogoutButton compact />
          </div>
        </div>
        <nav className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none]">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700"
            >
              <span>{item.icon}</span>
              {t(item.label)}
              {item.href === "/admin/reportes" && pendingReports > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{pendingReports}</span>
              )}
            </Link>
          ))}
          {pendingReview > 0 && (
            <Link
              href="/admin/users?pendientes=1"
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800"
            >
              <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{pendingReview}</span>
              {t("Por revisar")}
            </Link>
          )}
        </nav>
      </header>

      <aside className="hidden w-60 shrink-0 bg-white border-r border-gray-200 flex-col lg:flex">
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐝</span>
            <div>
              <p className="text-sm font-bold text-amber-600 leading-none">Cabibee</p>
              <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{t("Panel de administración")}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors group"
            >
              <span className="text-base group-hover:scale-110 transition-transform">
                {item.icon}
              </span>
              {t(item.label)}
              {item.href === "/admin/reportes" && pendingReports > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {pendingReports}
                </span>
              )}
            </Link>
          ))}
          {pendingReview > 0 && (
            <Link
              href="/admin/users?pendientes=1"
              className="mt-2 flex items-center gap-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 hover:bg-amber-100"
            >
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{pendingReview}</span>
              {t("Comprobantes y reclamos por revisar")}
            </Link>
          )}
        </nav>

        <div className="px-4 py-4 border-t border-gray-100">
          <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 font-medium">
              Admin
            </span>
            <Link
              href="/host/dashboard"
              className="text-[11px] text-amber-600/80 hover:text-amber-700 transition-colors"
            >
              {t("Anfitrión")}
            </Link>
            <span className="text-gray-200">|</span>
            <Link
              href="/"
              className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              {t("← Sitio")}
            </Link>
          </div>
          <LangSwitch className="mt-2" />
          <AdminLogoutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 lg:overflow-auto">
        {children}
      </main>
    </div>
  );
}
