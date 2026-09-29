import { getSessionUser } from "@/lib/session";
import { TabHeader } from "../_components/top-bar";
import { HostToday } from "./host-today";

export const metadata = { title: "Hoy" };

export default async function AppHostTodayPage() {
  const user = await getSessionUser();
  const first = user?.fullName?.trim().split(" ")[0];
  return (
    <>
      <TabHeader title={first ? `Hola, ${first}` : "Hoy"} subtitle="Lo importante de tus anuncios, de un vistazo." />
      <HostToday />
    </>
  );
}
