import { getT } from "@/lib/i18n/server";
import { TokenPanel } from "./token-panel";

export default async function ExtensionPage() {
  const t = await getT();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{t("Extensión de Chrome")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          {t(
            "Abres un anuncio en Facebook Marketplace, un grupo de Facebook, Trovit, Inmuebles24 o cualquier sitio de alojamientos, y con un clic lo mandas a Cabibee. La extensión toma el texto exacto y las fotos originales; la IA arma el borrador y tú lo revisas aquí."
          )}
        </p>
      </div>

      <ol className="list-decimal space-y-2 rounded-xl border border-gray-200 bg-white p-5 pl-10 text-sm text-gray-700">
        <li>
          {t("Copia la carpeta")} <code className="rounded bg-gray-100 px-1">chrome-extension</code> {t("del proyecto a tu computadora.")}
        </li>
        <li>
          {t("En Chrome abre")} <code className="rounded bg-gray-100 px-1">chrome://extensions</code>, {t("activa")}{" "}
          <strong>{t("Modo de desarrollador")}</strong> {t("y elige")} <strong>{t("Cargar descomprimida")}</strong> {t("con esa carpeta.")}
        </li>
        <li>{t("Genera tu token abajo y pégalo en la extensión junto con la dirección de Cabibee.")}</li>
        <li>
          {t("En cada anuncio: abre la galería y pasa por todas las fotos (para que carguen), luego clic en el ícono 🐝 →")}{" "}
          <strong>{t("Importar a Cabibee")}</strong>.
        </li>
        <li>{t("Los borradores aparecen en Inicio → Por revisar.")}</li>
      </ol>

      <TokenPanel />

      <p className="text-xs text-gray-400">
        {t("Usa la extensión a mano, un anuncio a la vez. No automatices la navegación: Facebook bloquea cuentas que se comportan como bots.")}
      </p>
    </div>
  );
}
