import Link from "next/link";
import { redirect } from "next/navigation";
import { LangSwitch } from "@/components/lang-switch";
import { canUseAssociatePanel } from "@/lib/associate-auth";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Asociados · Cabibee") };
}
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/asociados", label: "Inicio" },
  { href: "/asociados/capturar", label: "Subir capturas" },
  { href: "/asociados/extension", label: "Extensión de Chrome" },
];

export default async function AssociatesLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/asociados");
  if (!canUseAssociatePanel(user)) redirect("/");
  const t = await getT();

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
          <span className="ml-auto text-xs text-gray-400">{user.email}</span>
          <LangSwitch />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
