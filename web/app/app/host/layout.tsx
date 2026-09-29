import { getSessionUser } from "@/lib/session";
import { AuthGate } from "../_components/auth-gate";
import { TabHeader } from "../_components/top-bar";
import { BecomeHost } from "./become-host";

export default async function AppHostLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  if (!user) {
    return (
      <>
        <TabHeader title="Modo anfitrión" />
        <AuthGate
          host
          title="Publica tu espacio en Cabibee"
          message="Para ser anfitrión necesitas una cuenta. Publicar es gratis y la misma cuenta te sirve para viajar."
          next="/host"
          perks={[
            "Sube tus anuncios desde el celular",
            "Recibe y contesta mensajes del chat web gratis",
            "Activa el motor de reservas cuando quieras cobrar reservas en Cabibee",
          ]}
        />
      </>
    );
  }

  if (user.role === "guest") {
    return (
      <>
        <TabHeader title="Modo anfitrión" />
        <BecomeHost name={user.fullName} />
      </>
    );
  }

  return <>{children}</>;
}
