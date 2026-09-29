import { getSessionUser } from "@/lib/session";
import { ProfileView } from "../_components/profile-view";

export const metadata = { title: "Perfil" };

export default async function AppProfilePage() {
  const user = await getSessionUser();
  return <ProfileView user={user} mode="guest" />;
}
