import { HostStatsView } from "@/components/host/host-stats-view";
import { StatsEmailGate } from "@/components/host/stats-email-gate";
import { getLang, getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { statsLocked } from "@/lib/stats-access";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Estadísticas") };
}

export default async function WebHostStatsPage() {
  const user = (await getSessionUser())!;
  const [t, lang] = await Promise.all([getT(), getLang()]);
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-1 text-2xl font-bold text-[#222]">{t("Estadísticas y sugerencias")}</h1>
      <p className="mb-6 text-sm text-[#717171]">{t("Quién ve tus anuncios y qué mejorar para que te contacten más.")}</p>
      {statsLocked(user) ? (
        <StatsEmailGate email={user.email} placeholder={Boolean(user.placeholderEmail)} />
      ) : (
        <HostStatsView hostId={user.id} t={t} lang={lang} surface="web" />
      )}
    </div>
  );
}
