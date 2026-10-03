import { HostStatsView } from "@/components/host/host-stats-view";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Estadísticas") };
}

export default async function WebHostStatsPage() {
  const user = (await getSessionUser())!;
  const t = await getT();
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-1 text-2xl font-bold text-[#222]">{t("Estadísticas y sugerencias")}</h1>
      <p className="mb-6 text-sm text-[#717171]">{t("Quién ve tus anuncios y qué mejorar para que te contacten más.")}</p>
      <HostStatsView hostId={user.id} t={t} surface="web" />
    </div>
  );
}
