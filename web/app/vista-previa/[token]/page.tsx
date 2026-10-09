import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingCard } from "@/components/listing-card";
import { ListingDetailView } from "@/components/listing/listing-detail-view";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { canUseAssociatePanel } from "@/lib/associate-auth";
import { getPreview } from "@/lib/associate-preview-store";
import { stripHostContactChannels } from "@/lib/host-contact-policy";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** El anuncio del borrador tal como quedará publicado. Sólo lo ve el asociado que lo armó. */
export default async function DraftPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ vista?: string; como?: string }>;
}) {
  const [{ token }, q, viewer, t] = await Promise.all([params, searchParams, getSessionUser(), getT()]);
  if (!viewer || !canUseAssociatePanel(viewer)) notFound();
  const preview = getPreview(token, viewer);
  if (!preview) {
    return <p className="p-10 text-center text-sm text-gray-500">{t("La vista previa expiró. Ciérrala y ábrela otra vez.")}</p>;
  }
  const { detail, card } = preview;

  if (q.vista === "tarjeta") {
    return (
      <div className="min-h-screen bg-[#f7f7f7] p-6">
        <div inert className="mx-auto max-w-sm">
          <ListingCard listing={card} />
        </div>
      </div>
    );
  }

  const guest = q.como === "visitante";
  return (
    <>
      <div inert>
        <SiteHeader />
      </div>
      <div style={{ paddingTop: "72px" }}>
        <ListingDetailView
          listing={detail}
          slug={detail.slug}
          host={guest ? stripHostContactChannels(detail.host) : detail.host}
          canViewContacts={!guest}
          bookable={preview.bookable}
          unclaimed={preview.unclaimed}
          showReport
          preview
        />
      </div>
      <div inert>
        <SiteFooter />
      </div>
    </>
  );
}
