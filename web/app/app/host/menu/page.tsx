import { getSessionUser } from "@/lib/session";
import { ProfileView } from "../../_components/profile-view";

export const metadata = { title: "Menú de anfitrión" };

export default async function AppHostMenuPage() {
  const user = await getSessionUser();
  return <ProfileView user={user} mode="host" />;
}
