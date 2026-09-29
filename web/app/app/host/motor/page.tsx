import { Suspense } from "react";
import { TopBar } from "../../_components/top-bar";
import { BookingEngine } from "./booking-engine";

export const metadata = { title: "Motor de reservas" };

export default function AppHostEnginePage() {
  return (
    <>
      <TopBar title="Motor de reservas" back="/host/menu" />
      <Suspense>
        <BookingEngine />
      </Suspense>
    </>
  );
}
