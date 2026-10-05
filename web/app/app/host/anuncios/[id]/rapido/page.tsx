import { getT } from "@/lib/i18n/server";
import { QuickListingEditor } from "../quick-editor";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Edición rápida") };
}

export default async function AppQuickEditListingPage({ params }: Props) {
  const { id } = await params;
  return <QuickListingEditor listingId={id} />;
}
