import { QuickListingEditor } from "./quick-editor";

type Props = { params: Promise<{ id: string }> };

export const metadata = { title: "Editar anuncio" };

export default async function AppEditListingPage({ params }: Props) {
  const { id } = await params;
  return <QuickListingEditor listingId={id} />;
}
