import { HostRequestsClient } from "./requests-client";

export default function HostRequestsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#484848]">Solicitudes de reserva</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#888]">
        Revisa solicitudes sin cuenta (token de 6 dígitos). Puedes ajustar fechas o alojamiento antes de aceptar;
        el huésped podrá completar datos cuando el estado pase a «esperando datos».
      </p>
      <HostRequestsClient />
    </div>
  );
}
