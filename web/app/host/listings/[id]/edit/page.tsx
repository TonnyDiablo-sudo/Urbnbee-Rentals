import { Suspense } from "react";
import { ListingEditor } from "@/components/host/listing-editor";
import { getT } from "@/lib/i18n/server";

type Props = { params: Promise<{ id: string }> };

export default async function EditHostListingPage({ params }: Props) {
  const { id } = await params;
  const t = await getT();
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-[#ebebeb] bg-white p-12 text-center text-[#888]">
          {t("Cargando editor…")}
        </div>
      }
    >
      <ListingEditor listingId={id} />
    </Suspense>
  );
}
