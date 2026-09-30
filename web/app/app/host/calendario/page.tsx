import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import { TabHeader } from "../../_components/top-bar";
import { HostCalendar } from "./host-calendar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Calendario") };
}

export default async function AppHostCalendarPage() {
  const t = await getT();
  return (
    <>
      <TabHeader title={t("Calendario")} subtitle={t("Toca la primera y la última noche para elegir el rango. Toca una noche elegida para quitarla.")} />
      <Suspense>
        <HostCalendar />
      </Suspense>
    </>
  );
}
