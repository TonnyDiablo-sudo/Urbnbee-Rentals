import { StripeConnectPanel } from "@/components/host/stripe-connect-panel";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "../../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Cobros con Stripe") };
}

export default async function AppHostPaymentsPage() {
  const t = await getT();
  return (
    <>
      <TopBar title={t("Cobros con Stripe")} back="/host/motor" />
      <div className="px-5 pb-10 pt-4">
        <p className="mb-4 text-sm leading-relaxed text-[#666]">
          {t("El huésped te paga a ti, no a Cabibee. Conecta tu propia cuenta de Stripe en 3 pasos; si todavía no tienes, aquí te ayudamos a crearla.")}
        </p>
        <StripeConnectPanel />
      </div>
    </>
  );
}
