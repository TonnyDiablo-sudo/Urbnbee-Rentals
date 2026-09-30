import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { AuthGate } from "../_components/auth-gate";
import { TabHeader } from "../_components/top-bar";
import { GuestThreadList } from "./thread-list";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Mensajes") };
}

export default async function AppGuestMessagesPage() {
  const user = await getSessionUser();
  const t = await getT();
  return (
    <>
      <TabHeader title={t("Mensajes")} />
      {user ? (
        <GuestThreadList />
      ) : (
        <AuthGate
          title="Chatea con anfitriones"
          message="Para escribirle a un anfitrión necesitas una cuenta gratuita. Así cuidamos a todos del spam y las estafas."
          next="/mensajes"
          perks={["Pregunta por disponibilidad y precios", "Recibe las respuestas aquí mismo", "Ve teléfono y WhatsApp del anfitrión"]}
        />
      )}
    </>
  );
}
