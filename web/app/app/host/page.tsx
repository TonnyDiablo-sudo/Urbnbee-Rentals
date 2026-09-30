import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { TabHeader } from "../_components/top-bar";
import { HostToday } from "./host-today";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Hoy") };
}

export default async function AppHostTodayPage() {
  const user = await getSessionUser();
  const t = await getT();
  const first = user?.fullName?.trim().split(" ")[0];
  return (
    <>
      <TabHeader title={first ? t("Hola, {name}", { name: first }) : t("Hoy")} subtitle={t("Lo importante de tus anuncios, de un vistazo.")} />
      <HostToday />
    </>
  );
}
