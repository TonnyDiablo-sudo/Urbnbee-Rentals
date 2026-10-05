import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingInsightsView } from "@/components/host/listing-insights-view";
import { StatsEmailGate } from "@/components/host/stats-email-gate";
import { getLang, getT } from "@/lib/i18n/server";
import { listingInsights, parseInsightRange } from "@/lib/listing-insights";
import { getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Estadísticas del anuncio") };
}

export default async function WebListingStatsPage({
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
  const locked = user.role !== "admin" && !user.emailVerifiedAt;
  const data = locked ? null : listingInsights(listing.id, listing.hostId, parseInsightRange(d));
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/host/estadisticas" className="text-sm font-semibold text-[#222] underline">
        ← {t("Estadísticas y sugerencias")}
      </Link>
      <h1 className="mb-5 mt-3 text-2xl font-bold text-[#222]">{t("Estadísticas del anuncio")}</h1>
      {!data ? (
        <StatsEmailGate email={user.email} placeholder={Boolean(user.placeholderEmail)} />
      ) : (
      <ListingInsightsView
        listing={listing}
        data={data}
        t={t}
        lang={lang}
        surface="web"
        basePath={`/host/estadisticas/${listing.id}`}
      />
      )}
    </div>
  );
}
