import { getSessionUser } from "@/lib/session";
import { AuthGate } from "../_components/auth-gate";
import { TabHeader } from "../_components/top-bar";
import { GuestThreadList } from "./thread-list";

export const metadata = { title: "Mensajes" };

export default async function AppGuestMessagesPage() {
  const user = await getSessionUser();
  return (
    <>
      <TabHeader title="Mensajes" />
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
