import { EarningsReport } from "@/components/money/money-reports";
import { getLang, getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Pagos recibidos") };
}

export default async function WebHostEarningsPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const [sp, user, t, lang] = await Promise.all([searchParams, getSessionUser(), getT(), getLang()]);
  if (!user) return null;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-[#222]">{t("Pagos recibidos")}</h1>
      <p className="mb-6 mt-1 text-sm text-[#717171]">{t("Tu reporte de ingresos por año. Expórtalo a CSV para tu contador.")}</p>
      <EarningsReport hostId={user.id} yearParam={sp.anio} basePath="/host/pagos-recibidos" detailsBase="/host/reservas" t={t} lang={lang} />
    </div>
  );
}
