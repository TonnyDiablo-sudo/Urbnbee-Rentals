import { getT } from "@/lib/i18n/server";
import { QuickListingEditor } from "./quick-editor";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Editar anuncio") };
}

export default async function AppEditListingPage({ params }: Props) {
  const { id } = await params;
  return <QuickListingEditor listingId={id} />;
}
