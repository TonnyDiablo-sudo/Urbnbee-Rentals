import { ReportCenter } from "@/components/reports/report-center";
import { getT } from "@/lib/i18n/server";
import { reportPrefillFrom, type ReportSearchParams } from "@/lib/report-prefill";
import { getSessionUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Reportes y sugerencias") };
}

export default async function GuestReportsPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const [sp, user, t] = await Promise.all([searchParams, getSessionUser(), getT()]);
  if (!user) return null;
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-[#222]">{t("Reportes y sugerencias")}</h1>
      <p className="mb-6 mt-1 text-sm text-[#717171]">
        {t("Denuncia una cuenta, reclama la tuya, cuéntanos si algo salió mal o mándanos ideas. Solo el equipo de Cabibee lo lee.")}
      </p>
      <ReportCenter mode="guest" prefill={reportPrefillFrom(sp, user.id)} />
    </div>
  );
}
