import { Suspense } from "react";
import { AddressProofPanel } from "@/components/host/address-proof-panel";
import { EngineListingsPanel } from "@/components/host/engine-listings-panel";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "../../_components/top-bar";
import { BookingEngine } from "./booking-engine";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Reservas en línea") };
}

export default async function AppHostEnginePage() {
  const t = await getT();
  return (
    <>
      <TopBar title={t("Reservas en línea")} back="/host/menu" />
      <Suspense>
        <BookingEngine />
      </Suspense>
      <div className="space-y-6 px-5 pb-10 pt-2">
        <EngineListingsPanel />
        <AddressProofPanel surface="app" />
      </div>
    </>
  );
}
