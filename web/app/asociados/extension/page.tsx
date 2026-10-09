import { headers } from "next/headers";
import Link from "next/link";
import { autopilotSettings, canUseAutopilot } from "@/lib/associate-autopilot";
import { chromeExtensionVersion } from "@/lib/chrome-extension-zip";
import { deviceFromUa } from "@/lib/device";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { CopyText } from "./copy-text";
import { TokenPanel } from "./token-panel";

export default async function ExtensionPage() {
  const t = await getT();
  const version = chromeExtensionVersion();
  const onPhone = deviceFromUa((await headers()).get("user-agent") ?? "") !== "desktop";
  const plus = canUseAutopilot(await getSessionUser());
  const autopilot = autopilotSettings();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{t("Extensión de Chrome (computadora)")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          {t(
            "Abres un anuncio en Facebook Marketplace, un grupo de Facebook, Trovit, Inmuebles24 o cualquier sitio de alojamientos, y con un clic lo mandas a Cabibee. La extensión toma el texto exacto y las fotos originales; la IA arma el borrador y tú lo revisas aquí."
          )}
        </p>
      </div>

      {onPhone && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t("La extensión sólo funciona en Chrome, Edge o Brave de computadora. En el celular usa")}{" "}
          <Link href="/asociados/celular" className="font-semibold underline">
            {t("Compartir desde el celular")}
          </Link>
          .
        </p>
      )}

      <section className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-5">
        <div className="flex-1">
          <p className="text-base font-semibold text-gray-900">{t("1. Descarga la extensión")}</p>
          <p className="mt-1 text-xs text-gray-600">
            {version ? t("Versión {v} · ya trae la dirección de Cabibee configurada.", { v: version }) : t("No disponible en este servidor.")}
          </p>
        </div>
        {version && (
          <a
            href="/api/associate/extension"
            download
            className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
          >
            ⬇ {t("Descargar extensión")}
          </a>
        )}
      </section>

      <section className="rounded-xl border-2 border-amber-300 bg-white p-5">
        <p className="text-base font-semibold text-gray-900">{t("2. Descomprime el archivo (obligatorio)")}</p>
        <p className="mt-1 text-sm text-gray-600">
          {t("Chrome no puede usar el archivo .zip directo: primero hay que descomprimirlo.")}
        </p>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-gray-700">
          <li>
            {t("Abre tu carpeta Descargas y busca")} <code className="rounded bg-gray-100 px-1">cabibee-extension.zip</code>.
          </li>
          <li>
            <strong>Windows:</strong> {t("clic derecho sobre el archivo → Extraer todo… → Extraer.")}{" "}
            <strong>Mac:</strong> {t("doble clic sobre el archivo.")}
          </li>
          <li>
            {t("Te queda una carpeta normal (sin cierre) llamada")}{" "}
            <code className="rounded bg-gray-100 px-1">cabibee-extension</code>.{" "}
            {t("Ábrela y revisa que adentro esté el archivo")} <code className="rounded bg-gray-100 px-1">manifest.json</code>.
          </li>
          <li>
            {t("Mueve esa carpeta a un lugar fijo, por ejemplo Documentos. Si la borras, la extensión deja de funcionar.")}
          </li>
        </ol>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-base font-semibold text-gray-900">{t("3. Instálala en Chrome (una sola vez)")}</p>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-gray-700">
          <li>
            {t("Abre una pestaña nueva, pega esta dirección y da Enter:")}
            <CopyText value="chrome://extensions" />
            <span className="text-xs text-gray-500">{t("En Edge es edge://extensions y en Brave brave://extensions.")}</span>
          </li>
          <li>
            {t("Arriba a la derecha activa")} <strong>{t("Modo de desarrollador")}</strong>.
          </li>
          <li>
            {t("Clic en")} <strong>{t("Cargar descomprimida")}</strong> {t("y elige la carpeta")}{" "}
            <code className="rounded bg-gray-100 px-1">cabibee-extension</code>{" "}
            {t("que descomprimiste (la que tiene manifest.json adentro), no el archivo .zip.")}
            <span className="mt-1 block text-xs text-gray-500">
              {t("Si sale “Manifest file is missing or unreadable”: elegiste el .zip o una carpeta de más arriba. Entra a la carpeta hasta ver manifest.json y elige esa.")}
            </span>
          </li>
          <li>{t("Clic en la pieza de rompecabezas 🧩 junto a la barra de direcciones y fija 📌 Cabibee para tenerla siempre a la mano.")}</li>
          <li>{t("Clic en el ícono de Cabibee, pega tu token (abajo) y Guardar. La dirección ya viene puesta.")}</li>
        </ol>
        <p className="mt-3 text-xs text-gray-500">
          {t("Chrome puede mostrar el aviso “Desactiva las extensiones en modo de desarrollador”: elige Conservar o ciérralo. Es normal porque la extensión no viene de la Chrome Web Store.")}
        </p>
      </section>

      <section className="space-y-3">
        <p className="text-base font-semibold text-gray-900">{t("4. Tu token")}</p>
        <TokenPanel />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-base font-semibold text-gray-900">{t("5. Úsala en cada anuncio")}</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-700">
          <li>{t("Abre el anuncio y pasa por todas las fotos de la galería para que carguen.")}</li>
          <li>
            {t("Clic en el ícono de Cabibee →")} <strong>{t("Importar esta página")}</strong>.
          </li>
          <li>{t("Cuando el ícono muestre ✓, el borrador aparece en Inicio → Por revisar.")}</li>
        </ol>
      </section>

      {plus ? (
        <section className="rounded-xl border-2 border-violet-300 bg-violet-50 p-5">
          <p className="text-base font-semibold text-gray-900">
            {t("6. Piloto automático")}{" "}
            <span className="ml-1 rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white">PLUS</span>
          </p>
          <p className="mt-1 text-sm text-gray-700">
            {t("Tu cuenta es Asociado Plus: la extensión puede abrir los anuncios de una búsqueda uno por uno y mandarlos a revisión sola, con tu sesión y en tu Chrome.")}
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-700">
            <li>{t("Abre una página de resultados: Facebook Marketplace → Propiedades en alquiler (con tu ciudad), Inmuebles24, Lamudi, Vivanuncios, Casas y Terrenos, Mercado Libre…")}</li>
            <li>{t("Si el anuncio sólo muestra el WhatsApp después de dejar un teléfono, el piloto llena el formulario con una línea de Cabibee (las da de alta el admin). Si no hay líneas libres o el formulario pide captcha, el borrador llega sin contacto.")}</li>
            <li>
              {t("Clic en el ícono de Cabibee →")} <strong>{t("▶ Iniciar en esta búsqueda")}</strong>.
            </li>
            <li>{t("Se abre otra pestaña donde va pasando por cada anuncio y su galería. No la uses mientras trabaja; puedes seguir en otras pestañas.")}</li>
            <li>{t("Para detenerlo: botón Pausar en la barra negra de esa pestaña o en el ícono de Cabibee.")}</li>
            <li>{t("Los borradores llegan a Inicio → Por revisar. Nada se publica sin que tú lo revises.")}</li>
          </ol>
          <p className="mt-3 text-xs text-gray-600">
            {t(
              "Puedes tenerlo trabajando en varias páginas a la vez (una búsqueda por página). Cada página tiene su propio tope diario y espera al menos {sec} segundos entre anuncios. Se salta los que ya están en Cabibee y se detiene solo si el sitio pide iniciar sesión o verificar que eres tú.",
              { sec: autopilot.minDelaySec }
            )}
          </p>
          <ul className="mt-2 grid gap-x-4 text-xs text-gray-600 sm:grid-cols-2">
            {Object.entries(autopilot.limits).map(([site, limit]) => (
              <li key={site}>
                {site}: <strong>{t("{n} al día", { n: limit })}</strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-700">
        <p className="font-semibold text-gray-900">{t("Actualizar a una versión nueva")}</p>
        <p className="mt-1">
          {t("Descarga el ZIP otra vez, descomprímelo, reemplaza con eso el contenido de tu carpeta cabibee-extension y en chrome://extensions da clic en ↻ (Recargar) en la tarjeta de Cabibee. Tu token se conserva.")}
        </p>
      </section>

      <p className="text-xs text-gray-400">
        {plus
          ? t("No uses otros programas para automatizar ni bajes los tiempos del piloto: Facebook bloquea cuentas que se comportan como bots.")
          : t("Usa la extensión a mano, un anuncio a la vez. No automatices la navegación: Facebook bloquea cuentas que se comportan como bots.")}
      </p>
    </div>
  );
}
