import { HostStatsView } from "@/components/host/host-stats-view";
import { StatsEmailGate } from "@/components/host/stats-email-gate";
import { getLang, getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { statsLocked } from "@/lib/stats-access";
import { TopBar } from "../../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Estadísticas") };
}

export default async function HostStatsPage() {
  const user = (await getSessionUser())!;
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const locked = statsLocked(user);
  return (
    <>
      <TopBar title={t("Estadísticas y sugerencias")} />
      <div className="px-5 pb-10 pt-4">
        {locked ? (
          <StatsEmailGate email={user.email} placeholder={Boolean(user.placeholderEmail)} />
        ) : (
          <HostStatsView hostId={user.id} t={t} lang={lang} surface="app" />
        )}
      </div>
    </>
  );
}
