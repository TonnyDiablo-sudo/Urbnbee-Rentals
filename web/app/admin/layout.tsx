import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/session";

const NAV = [
  { href: "/admin/overview", label: "Resumen", icon: "📊" },
  { href: "/admin/users", label: "Usuarios", icon: "👥" },
  { href: "/admin/bookings", label: "Reservas", icon: "🏠" },
  { href: "/admin/logs", label: "Actividad", icon: "📋" },
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

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐝</span>
            <div>
              <p className="text-sm font-bold text-amber-600 leading-none">Urbnbee</p>
              <p className="text-[10px] text-gray-400 leading-tight mt-0.5">Panel de administración</p>
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
              {item.label}
            </Link>
          ))}
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
              Anfitrión
            </Link>
            <span className="text-gray-200">|</span>
            <Link
              href="/"
              className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Sitio
            </Link>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
