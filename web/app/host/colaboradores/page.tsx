import { TeamPanel } from "@/components/host/team-panel";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Colaboradores") };
}

export default async function WebHostTeamPage() {
  const t = await getT();
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-1 text-2xl font-bold text-[#222]">{t("Colaboradores")}</h1>
      <p className="mb-6 text-sm text-[#717171]">{t("Personas que te ayudan con reservas, mensajes o limpieza.")}</p>
      <TeamPanel />
    </div>
  );
}