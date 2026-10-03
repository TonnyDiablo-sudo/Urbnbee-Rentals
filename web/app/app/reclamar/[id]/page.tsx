import { notFound } from "next/navigation";
import { ClaimRequestForm } from "@/components/listing/claim-request-form";
import { getT } from "@/lib/i18n/server";
import { isListingUnclaimed } from "@/lib/listing-claim-status";
import { getListingById } from "@/lib/marketplace-store";
import { TopBar } from "../../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Reclamar anuncio") };
}

export default async function AppClaimListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = getListingById(id);
  if (!listing || !isListingUnclaimed(id)) notFound();
  const t = await getT();
  return (
    <>
      <TopBar title="" back={`/alojamiento/${listing.slug}`} />
      <div className="px-6 pb-10 pt-2">
        <h1 className="text-[26px] font-bold text-[#222]">{t("¿Es tu anuncio?")}</h1>
        <p className="mt-1.5 mb-6 text-sm leading-relaxed text-[#717171]">
          {t("Publicar en Cabibee es gratis. Si es tuyo, te damos acceso para editarlo, cambiar tus datos o borrarlo cuando quieras.")}
        </p>
        <ClaimRequestForm listingId={listing.id} listingTitle={listing.title} />
      </div>
    </>
  );
}
