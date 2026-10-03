import { HostStatsView } from "@/components/host/host-stats-view";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { TopBar } from "../../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Estadísticas") };
}

export default async function HostStatsPage() {
  const user = (await getSessionUser())!;
  const t = await getT();
  return (
    <>
      <TopBar title={t("Estadísticas y sugerencias")} />
      <div className="px-5 pb-10 pt-4">
        <HostStatsView hostId={user.id} t={t} surface="app" />
      </div>
    </>
  );
}
