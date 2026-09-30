import { Suspense } from "react";
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
    </>
  );
}
