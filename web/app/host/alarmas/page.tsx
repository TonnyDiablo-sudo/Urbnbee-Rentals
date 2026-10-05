import { AlarmCenter } from "@/components/host/alarm-center";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Centro de alarmas") };
}

export default async function WebHostAlarmsPage() {
  const t = await getT();
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-4 text-2xl font-bold text-[#222]">{t("Centro de alarmas")}</h1>
      <AlarmCenter />
    </div>
  );
}
