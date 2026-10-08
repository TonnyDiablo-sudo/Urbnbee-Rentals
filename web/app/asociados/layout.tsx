import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { AndroidShareBanner, AssociatePwaRegister } from "@/components/associates/pwa";
import { LangSwitch } from "@/components/lang-switch";
import { canUseAssociatePanel } from "@/lib/associate-auth";
import { getAssociateStats } from "@/lib/associate-stats";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Asociados · Cabibee"),
    manifest: "/asociados/app.webmanifest",
    appleWebApp: { capable: true, title: "Cabibee Asociados", statusBarStyle: "default" },
  };
}
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/asociados", label: "Inicio" },
  { href: "/asociados/cuentas", label: "Mis cuentas" },
  { href: "/asociados/capturar", label: "Agregar anuncio" },
  { href: "/asociados/celular", label: "Celular" },
  { href: "/asociados/extension", label: "Extensión" },
];

export default async function AssociatesLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/asociados");
  if (!canUseAssociatePanel(user)) redirect("/");
  const t = await getT();
  const s = getAssociateStats(user, 1);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-6 py-4">
          <Link href="/asociados" className="flex items-center gap-2">
            <span className="text-xl">🐝</span>
            <span className="text-sm font-bold text-amber-600">{t("Cabibee · Asociados")}</span>
          </Link>
          <nav className="flex flex-wrap gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700"
              >
                {t(n.label)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                s.goal > 0 && s.today >= s.goal ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              {s.goal > 0 ? t("Hoy: {done} de {goal}", { done: s.today, goal: s.goal }) : t("Hoy: {done}", { done: s.today })}
            </span>
            <span className="hidden max-w-[160px] truncate text-xs text-gray-400 xl:inline" title={user.email}>
              {user.email}
            </span>
            <LangSwitch />
            <AdminLogoutButton compact />
          </div>
        </div>
      </header>
      <AssociatePwaRegister />
      <AndroidShareBanner />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
