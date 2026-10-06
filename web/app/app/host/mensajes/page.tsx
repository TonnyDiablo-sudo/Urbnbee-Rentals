import { ChatsSwitch } from "@/components/team/chats-switch";
import { getT } from "@/lib/i18n/server";
import { TabHeader } from "../../_components/top-bar";
import { HostInbox } from "./host-inbox";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Mensajes") };
}

export default async function AppHostMessagesPage() {
  const t = await getT();
  return (
    <>
      <TabHeader title={t("Mensajes")} subtitle={t("Chats con huéspedes y con tu equipo. Es gratis.")} />
      <ChatsSwitch guestsLabel="Huéspedes" own>
        <HostInbox />
      </ChatsSwitch>
    </>
  );
}
