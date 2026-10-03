import { TeamWorkspace } from "@/components/team/team-workspace";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { AuthGate } from "../_components/auth-gate";
import { TopBar } from "../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Equipos donde colaboro") };
}

export default async function AppTeamPage() {
  const user = await getSessionUser();
  const t = await getT();
  return (
    <>
      <TopBar title={t("Equipos donde colaboro")} back="/perfil" />
      {user ? (
        <div className="px-5 pb-10 pt-4">
          <TeamWorkspace />
        </div>
      ) : (
        <AuthGate
          title="Entra para ver tus equipos"
          message="Si un anfitrión te invitó a colaborar, entra con el correo al que te llegó la invitación."
          next="/equipo"
        />
      )}
    </>
  );
}