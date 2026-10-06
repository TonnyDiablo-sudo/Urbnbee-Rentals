import { EarningsReport } from "@/components/money/money-reports";
import { getLang, getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { TopBar } from "../../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Pagos recibidos") };
}

export default async function AppHostEarningsPage({ searchParams }: { searchParams: Promise<{ anio?: string; mes?: string }> }) {
  const [sp, user, t, lang] = await Promise.all([searchParams, getSessionUser(), getT(), getLang()]);
  if (!user) return null;
  return (
    <>
      <TopBar title={t("Pagos recibidos")} back="/host/menu" />
      <div className="px-4 pb-10 pt-4 sm:px-6">
        <EarningsReport hostId={user.id} yearParam={sp.anio} monthParam={sp.mes} basePath="/host/pagos-recibidos" detailsBase="/host/reservas" t={t} lang={lang} />
      </div>
    </>
  );
}
