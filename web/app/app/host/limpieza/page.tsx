import { CleaningPanel } from "@/components/host/cleaning-panel";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "../../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Limpieza") };
}

export default async function AppHostCleaningPage() {
  const t = await getT();
  return (
    <>
      <TopBar title={t("Limpieza")} back="/perfil" />
      <div className="px-5 pb-10 pt-4">
        <CleaningPanel />
      </div>
    </>
  );
}