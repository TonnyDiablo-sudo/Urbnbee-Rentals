import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WhoWeAre } from "@/components/who-we-are";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Quiénes somos"),
    description: t(
      "Cabibee es la plataforma para rentar directo: sin comisión, con contacto a la vista y herramientas de seguridad para quien las quiera."
    ),
  };
}

export default function NosotrosPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-white" style={{ paddingTop: "72px" }}>
        <WhoWeAre />
      </main>
      <SiteFooter />
    </>
  );
}
