import { getT } from "@/lib/i18n/server";
import { HostRequestsClient } from "./requests-client";

export default async function HostRequestsPage() {
  const t = await getT();
  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#484848]">{t("Solicitudes de reserva")}</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#888]">
        {t(
          "Revisa las solicitudes entrantes. Puedes ajustar fechas o alojamiento antes de aceptar; el huésped podrá completar datos cuando el estado pase a «esperando datos»."
        )}
      </p>
      <HostRequestsClient />
    </div>
  );
}
