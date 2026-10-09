import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ListingDetailView } from "@/components/listing/listing-detail-view";
import { listingIsBookable } from "@/lib/app-listings";
import { getListingDetail } from "@/lib/get-listing-detail";
import { getSessionUser } from "@/lib/session";
import { emailConfirmed } from "@/lib/email-gate";
import { stripHostContactChannels } from "@/lib/host-contact-policy";
import { getLang } from "@/lib/i18n/server";
import { localizeListingDetail } from "@/lib/listing-localize";
import { isListingUnclaimed } from "@/lib/listing-claim-status";
import { trackListingView } from "@/lib/listing-view-tracking";
import { getListingById } from "@/lib/marketplace-store";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string; ref?: string }>;
};

export default async function ListingDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const q = await searchParams;
  const found = getListingDetail(slug);
  if (!found) notFound();

  const lang = await getLang();
  const listing = await localizeListingDetail(found, lang);
  const viewer = await getSessionUser();
  const record = getListingById(listing.id);
  const needsEmail = Boolean(viewer) && !emailConfirmed(viewer) && viewer?.id !== record?.hostId;
  const canViewHostContacts = Boolean(viewer) && !needsEmail;
  await trackListingView(record, viewer);

  return (
    <>
      <SiteHeader />

      {/* Top padding for fixed header */}
      <div style={{ paddingTop: "72px" }}>
        <ListingDetailView
          listing={listing}
          slug={slug}
          host={canViewHostContacts ? listing.host : stripHostContactChannels(listing.host)}
          canViewContacts={canViewHostContacts}
          emailGate={needsEmail ? { email: viewer?.email, placeholder: Boolean(viewer?.placeholderEmail) } : undefined}
          bookable={listingIsBookable(listing.id)}
          unclaimed={Boolean(record?.published) && isListingUnclaimed(listing.id)}
          showReport={Boolean(record?.published) && viewer?.id !== record?.hostId}
          query={q}
        />
      </div>

      <SiteFooter />
    </>
  );
}
