import { TeamPanel } from "@/components/host/team-panel";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "../../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Colaboradores") };
}

export default async function AppHostTeamPage() {
  const t = await getT();
  return (
    <>
      <TopBar title={t("Colaboradores")} back="/perfil" />
      <div className="px-5 pb-10 pt-4">
        <TeamPanel />
      </div>
    </>
  );
}