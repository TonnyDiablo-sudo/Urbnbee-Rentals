import { notFound } from "next/navigation";
import { ClaimRequestForm } from "@/components/listing/claim-request-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getT } from "@/lib/i18n/server";
import { isListingUnclaimed } from "@/lib/listing-claim-status";
import { getListingById } from "@/lib/marketplace-store";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Reclamar anuncio") };
}

export default async function ClaimListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = getListingById(id);
  if (!listing || !isListingUnclaimed(id)) notFound();
  const t = await getT();
  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-md px-4 pb-16" style={{ paddingTop: 104 }}>
        <h1 className="text-2xl font-semibold text-[#484848]">{t("¿Es tu anuncio?")}</h1>
        <p className="mt-2 mb-6 text-sm leading-relaxed text-[#717171]">
          {t("Publicar en Cabibee es gratis. Si es tuyo, te damos acceso para editarlo, cambiar tus datos o borrarlo cuando quieras.")}
        </p>
        <ClaimRequestForm listingId={listing.id} listingTitle={listing.title} />
      </div>
      <SiteFooter />
    </>
  );
}
