import { Suspense } from "react";
import { ListingEditor } from "@/components/host/listing-editor";

type Props = { params: Promise<{ id: string }> };

export default async function EditHostListingPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-[#ebebeb] bg-white p-12 text-center text-[#888]">
          Cargando editor…
        </div>
      }
    >
      <ListingEditor listingId={id} />
    </Suspense>
  );
}
