import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TeamWorkspace } from "@/components/team/team-workspace";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Equipos donde colaboro") };
}

export default async function TeamPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/equipo");
  const t = await getT();
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-[#fafafa]" style={{ paddingTop: "72px" }}>
        <div className="mx-auto max-w-3xl px-5 py-10">
          <h1 className="mb-4 text-2xl font-semibold text-[#222]">{t("Equipos donde colaboro")}</h1>
          <TeamWorkspace />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}