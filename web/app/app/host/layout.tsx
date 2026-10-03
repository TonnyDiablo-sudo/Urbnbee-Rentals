import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { AuthGate } from "../_components/auth-gate";
import { TopBar } from "../_components/top-bar";
import { BecomeHost } from "./become-host";

export default async function AppHostLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const t = await getT();

  if (!user) {
    return (
      <>
        <TopBar title={t("Modo anfitrión")} back="/" />
        <AuthGate
          host
          title="Publica tu espacio en Cabibee"
          message="Para ser anfitrión necesitas una cuenta. Publicar es gratis y la misma cuenta te sirve para viajar."
          next="/host"
          perks={[
            "Sube tus anuncios desde el celular",
            "Recibe y contesta mensajes del chat web gratis",
            "Activa las reservas en línea cuando quieras cobrar reservas en Cabibee",
          ]}
        />
      </>
    );
  }

  if (user.mustChangePassword) redirect("/cuenta/activar");

  if (user.role === "guest") {
    return (
      <>
        <TopBar title={t("Modo anfitrión")} back="/perfil" />
        <BecomeHost name={user.fullName} />
      </>
    );
  }

  return <>{children}</>;
}
