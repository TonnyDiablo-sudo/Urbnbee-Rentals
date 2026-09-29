import { TopBar } from "../../../_components/top-bar";
import { NewListingStart } from "./new-listing-start";

export const metadata = { title: "Nuevo anuncio" };

export default function AppNewListingPage() {
  return (
    <>
      <TopBar title="Nuevo anuncio" back="/host/anuncios" />
      <NewListingStart />
    </>
  );
}
