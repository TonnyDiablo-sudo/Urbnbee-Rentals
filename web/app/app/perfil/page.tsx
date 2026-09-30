import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { ProfileView } from "../_components/profile-view";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Perfil") };
}

export default async function AppProfilePage() {
  const user = await getSessionUser();
  return <ProfileView user={user} mode="guest" />;
}
