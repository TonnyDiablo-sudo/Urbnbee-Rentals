import { SpendingReport } from "@/components/money/money-reports";
import { getLang, getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Mis gastos") };
}

export default async function WebGuestSpendingPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const [sp, user, t, lang] = await Promise.all([searchParams, getSessionUser(), getT(), getLang()]);
  if (!user) return null;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-[#222]">{t("Mis gastos")}</h1>
      <p className="mb-6 mt-1 text-sm text-[#717171]">{t("Todo lo que has pagado en Cabibee, por año. Expórtalo a CSV.")}</p>
      <SpendingReport userId={user.id} yearParam={sp.anio} basePath="/guest/gastos" detailsBase="/guest/bookings" t={t} lang={lang} />
    </div>
  );
}
