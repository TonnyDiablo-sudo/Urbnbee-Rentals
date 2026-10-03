import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "../../_components/top-bar";
import { HostReviews } from "./host-reviews";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Reseñas de huéspedes") };
}

export default async function AppHostReviewsPage() {
  const t = await getT();
  return (
    <>
      <TopBar title={t("Reseñas de huéspedes")} back="/host/menu" />
      <Suspense>
        <HostReviews />
      </Suspense>
    </>
  );
}
