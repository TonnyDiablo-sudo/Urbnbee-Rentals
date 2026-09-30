import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { AuthGate } from "../_components/auth-gate";
import { TopBar } from "../_components/top-bar";
import { GuestMembership } from "./guest-membership";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Membresía de huésped") };
}

export default async function AppMembershipPage() {
  const user = await getSessionUser();
  const t = await getT();
  return (
    <>
      <TopBar title={t("Membresía de huésped")} back="/perfil" />
      {user ? (
        <Suspense>
          <GuestMembership />
        </Suspense>
      ) : (
        <AuthGate
          title="Reserva como huésped verificado"
          message="La membresía comprueba tu identidad y te abre las reservas protegidas de Cabibee."
          next="/membresia"
          perks={[
            "Reserva y paga dentro de Cabibee, con contrato",
            "Perfil de huésped verificado que los anfitriones sí aceptan",
            "Deja reseñas reales después de tu estancia",
          ]}
        />
      )}
    </>
  );
}
