import { getT } from "@/lib/i18n/server";
import { TopBar } from "../../../_components/top-bar";
import { NewListingStart } from "./new-listing-start";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Nuevo anuncio") };
}

export default async function AppNewListingPage() {
  const t = await getT();
  return (
    <>
      <TopBar title={t("Nuevo anuncio")} back="/host/anuncios" />
      <NewListingStart />
    </>
  );
}
