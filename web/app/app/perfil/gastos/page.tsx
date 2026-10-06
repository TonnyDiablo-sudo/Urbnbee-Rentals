import { SpendingReport } from "@/components/money/money-reports";
import { getLang, getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { AuthGate } from "../../_components/auth-gate";
import { TopBar } from "../../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Mis gastos") };
}

export default async function AppGuestSpendingPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const [sp, user, t, lang] = await Promise.all([searchParams, getSessionUser(), getT(), getLang()]);
  return (
    <>
      <TopBar title={t("Mis gastos")} back="/perfil" />
      {user ? (
        <div className="px-4 pb-10 pt-4 sm:px-6">
          <SpendingReport userId={user.id} yearParam={sp.anio} basePath="/perfil/gastos" detailsBase="/viajes" t={t} lang={lang} />
        </div>
      ) : (
        <AuthGate title="Tus gastos en Cabibee" message="Entra para ver cuánto has pagado y exportarlo." next="/perfil/gastos" />
      )}
    </>
  );
}
