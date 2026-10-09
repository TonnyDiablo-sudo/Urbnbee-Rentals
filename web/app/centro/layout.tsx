import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { hasStaffPermission, staffPermissionsOf } from "@/lib/staff";

export const dynamic = "force-dynamic";

export default async function CentroLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/centro");
  const perms = staffPermissionsOf(user);
  if (perms.length === 0) redirect("/");
  const t = await getT();
  const links = [
    hasStaffPermission(user, "appeals") ? { href: "/centro/resoluciones", label: "Resoluciones" } : null,
    hasStaffPermission(user, "reports") ? { href: "/centro/reportes", label: "Reportes" } : null,
    hasStaffPermission(user, "agent") ? { href: "/centro/revisor", label: "Revisor GPT-6" } : null,
  ].filter((x): x is { href: string; label: string } => Boolean(x));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3">
          <p className="text-sm font-bold text-amber-600">{t("Centro de administración")}</p>
          <nav className="flex gap-2">
            {links.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
                {t(item.label)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {user.role === "admin" && (
              <Link href="/admin/overview" className="text-xs text-amber-700">
                {t("Panel de administración")}
              </Link>
            )}
            <AdminLogoutButton compact />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
