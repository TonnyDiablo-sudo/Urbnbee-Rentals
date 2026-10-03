"use client";

import { useT } from "@/components/i18n-provider";
import { StripeConnectPanel } from "@/components/host/stripe-connect-panel";

export function HostPagosClient() {
  const t = useT();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#484848]">{t("Pagos de la estancia")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#666]">
          {t("El huésped te paga a ti, no a Cabibee. Conecta tu propia cuenta de Stripe en 3 pasos; si todavía no tienes, aquí te ayudamos a crearla.")}
        </p>
      </div>
      <StripeConnectPanel />
    </div>
  );
}
