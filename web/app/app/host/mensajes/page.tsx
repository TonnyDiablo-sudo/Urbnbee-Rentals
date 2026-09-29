import { TabHeader } from "../../_components/top-bar";
import { HostInbox } from "./host-inbox";

export const metadata = { title: "Mensajes" };

export default function AppHostMessagesPage() {
  return (
    <>
      <TabHeader title="Mensajes" subtitle="Chat web de tus anuncios. Es gratis." />
      <HostInbox />
    </>
  );
}
