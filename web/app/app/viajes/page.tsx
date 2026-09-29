import { Suspense } from "react";
import { getSessionUser } from "@/lib/session";
import { AuthGate } from "../_components/auth-gate";
import { TabHeader } from "../_components/top-bar";
import { TripsList } from "./trips-list";

export const metadata = { title: "Viajes" };

export default async function AppTripsPage() {
  const user = await getSessionUser();
  return (
    <>
      <TabHeader title="Viajes" />
      {user ? (
        <Suspense>
          <TripsList />
        </Suspense>
      ) : (
        <AuthGate
          title="Tus reservas, en un solo lugar"
          message="Cuando reserves con Cabibee verás aquí tus fechas, el estado de la reserva y el contrato."
          next="/app/viajes"
        />
      )}
    </>
  );
}
