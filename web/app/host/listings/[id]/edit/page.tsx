import { ListingEditor } from "@/components/host/listing-editor";

type Props = { params: Promise<{ id: string }> };

export default async function EditHostListingPage({ params }: Props) {
  const { id } = await params;
  return <ListingEditor listingId={id} />;
}
