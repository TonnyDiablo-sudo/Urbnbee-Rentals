import { CleaningPanel } from "@/components/host/cleaning-panel";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Limpieza") };
}

export default async function WebHostCleaningPage() {
  const t = await getT();
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-1 text-2xl font-bold text-[#222]">{t("Limpieza")}</h1>
      <p className="mb-6 text-sm text-[#717171]">{t("Limpiezas que salen solas de tus reservas, quién las hace y cuándo.")}</p>
      <CleaningPanel />
    </div>
  );
}