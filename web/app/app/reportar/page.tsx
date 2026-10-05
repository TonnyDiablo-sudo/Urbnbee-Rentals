import { redirect } from "next/navigation";
import { ReportCenter } from "@/components/reports/report-center";
import { getT } from "@/lib/i18n/server";
import { reportPrefillFrom, type ReportSearchParams } from "@/lib/report-prefill";
import { getSessionUser } from "@/lib/session";
import { TopBar } from "../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Reportes y sugerencias") };
}

export default async function AppReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const sp = await searchParams;
  const user = await getSessionUser();
  if (!user) {
    const qs = new URLSearchParams(
      Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v] as [string, string]] : []))
    ).toString();
    redirect(`/cuenta/entrar?next=${encodeURIComponent(`/reportar${qs ? `?${qs}` : ""}`)}`);
  }
  const t = await getT();
  const mode = sp.modo === "host" ? "host" : "guest";
  return (
    <>
      <TopBar title={t("Reportes y sugerencias")} back={mode === "host" ? "/host/menu" : "/perfil"} />
      <div className="px-5 pb-10 pt-4">
        <p className="mb-6 text-sm leading-relaxed text-[#717171]">
          {t("Denuncia una cuenta, reclama la tuya, cuéntanos si algo salió mal o mándanos ideas. Solo el equipo de Cabibee lo lee.")}
        </p>
        <ReportCenter mode={mode} prefill={reportPrefillFrom(sp, user.id)} />
      </div>
    </>
  );
}
