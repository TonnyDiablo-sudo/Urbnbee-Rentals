import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { ProfileView } from "../../_components/profile-view";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Menú de anfitrión") };
}

export default async function AppHostMenuPage() {
  const user = await getSessionUser();
  return <ProfileView user={user} mode="host" />;
}
