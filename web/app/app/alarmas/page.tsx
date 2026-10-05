import { AlarmCenter } from "@/components/host/alarm-center";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Centro de alarmas") };
}

export default async function AppAlarmsPage() {
  const t = await getT();
  return (
    <>
      <TopBar title={t("Centro de alarmas")} back="/notificaciones" />
      <div className="px-5 pb-10 pt-4">
        <AlarmCenter />
      </div>
    </>
  );
}
