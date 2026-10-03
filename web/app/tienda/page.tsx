import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StoreView } from "@/components/store/store-view";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Tienda") };
}

export default async function StorePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/tienda");
  const t = await getT();
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-[#fafafa]" style={{ paddingTop: "72px" }}>
        <div className="mx-auto max-w-4xl px-5 py-10">
          <h1 className="mb-4 text-2xl font-semibold text-[#222]">{t("Tienda")}</h1>
          <StoreView surface="web" />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
