import { Suspense } from "react";
import { getSessionUser } from "@/lib/session";
import { AuthGate } from "../_components/auth-gate";
import { TopBar } from "../_components/top-bar";
import { GuestMembership } from "./guest-membership";

export const metadata = { title: "Membresía de huésped" };

export default async function AppMembershipPage() {
  const user = await getSessionUser();
  return (
    <>
      <TopBar title="Membresía de huésped" back="/app/perfil" />
      {user ? (
        <Suspense>
          <GuestMembership />
        </Suspense>
      ) : (
        <AuthGate
          title="Reserva como huésped verificado"
          message="La membresía comprueba tu identidad y te abre las reservas protegidas de Cabibee."
          next="/app/membresia"
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
