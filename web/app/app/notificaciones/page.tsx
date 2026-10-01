import { getT } from "@/lib/i18n/server";
import { NotificationsList } from "./notifications-list";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Notificaciones") };
}

export default function AppNotificationsPage() {
  return <NotificationsList />;
}
