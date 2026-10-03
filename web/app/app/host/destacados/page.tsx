import { FeaturedListingsPanel } from "@/components/host/featured-listings-panel";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "../../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Anuncios destacados") };
}

export default async function AppHostFeaturedPage() {
  const t = await getT();
  return (
    <>
      <TopBar title={t("Anuncios destacados")} back="/host/herramientas" />
      <div className="px-5 pb-10 pt-4">
        <FeaturedListingsPanel />
      </div>
    </>
  );
}
