import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { AuthGate } from "../_components/auth-gate";
import { TabHeader } from "../_components/top-bar";
import { TripsList } from "./trips-list";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Viajes") };
}

export default async function AppTripsPage() {
  const user = await getSessionUser();
  const t = await getT();
  return (
    <>
      <TabHeader title={t("Viajes")} />
      {user ? (
        <Suspense>
          <TripsList />
        </Suspense>
      ) : (
        <AuthGate
          title="Tus reservas, en un solo lugar"
          message="Cuando reserves con Cabibee verás aquí tus fechas, el estado de la reserva y el contrato."
          next="/viajes"
        />
      )}
    </>
  );
}
