import { notFound } from "next/navigation";
import { ListingInsightsView } from "@/components/host/listing-insights-view";
import { StatsEmailGate } from "@/components/host/stats-email-gate";
import { getLang, getT } from "@/lib/i18n/server";
import { listingInsights, parseInsightRange } from "@/lib/listing-insights";
import { getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { TopBar } from "../../../_components/top-bar";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Estadísticas del anuncio") };
}

export default async function AppListingStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  const [{ id }, { d }, user] = await Promise.all([params, searchParams, getSessionUser()]);
  const listing = getListingById(id);
  if (!user || !listing || (listing.hostId !== user.id && user.role !== "admin")) notFound();
  const [t, lang] = await Promise.all([getT(), getLang()]);
  if (user.role !== "admin" && !user.emailVerifiedAt) {
    return (
      <>
        <TopBar title={t("Estadísticas del anuncio")} back="/host/estadisticas" />
        <div className="px-5 pb-10 pt-4">
          <StatsEmailGate email={user.email} placeholder={Boolean(user.placeholderEmail)} />
        </div>
      </>
    );
  }
  const data = listingInsights(listing.id, listing.hostId, parseInsightRange(d));
  return (
    <>
      <TopBar title={t("Estadísticas del anuncio")} back="/host/estadisticas" />
      <div className="px-5 pb-10 pt-4">
        <ListingInsightsView
          listing={listing}
          data={data}
          t={t}
          lang={lang}
          surface="app"
          basePath={`/host/estadisticas/${listing.id}`}
        />
      </div>
    </>
  );
}
