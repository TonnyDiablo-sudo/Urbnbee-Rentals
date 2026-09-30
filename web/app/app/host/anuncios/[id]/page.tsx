import { getT } from "@/lib/i18n/server";
import { ListingHub } from "./listing-hub";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Anuncio") };
}

export default async function AppEditListingPage({ params }: Props) {
  const { id } = await params;
  return <ListingHub listingId={id} />;
}
