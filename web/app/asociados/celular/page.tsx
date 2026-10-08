import { headers } from "next/headers";
import Link from "next/link";
import { InstallAppButton } from "@/components/associates/pwa";
import { SitesList } from "@/components/associates/sites-list";
import { deviceFromUa } from "@/lib/device";
import { getT } from "@/lib/i18n/server";

function Steps({ title, items }: { title: string; items: React.ReactNode[] }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-gray-700">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ol>
    </section>
  );
}

export default async function PhonePage({ searchParams }: { searchParams: Promise<{ compartido?: string }> }) {
  const t = await getT();
  const { compartido } = await searchParams;
  const device = deviceFromUa((await headers()).get("user-agent") ?? "");

  const android = (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-5">
        <h2 className="text-base font-semibold text-gray-900">{t("1. Instala Cabibee Asociados")}</h2>
        <InstallAppButton />
        <p className="text-sm text-gray-700">
          {t("Si no aparece el botón: en Chrome toca ⋮ (arriba a la derecha) → Instalar app o Agregar a pantalla principal → Instalar.")}
        </p>
        <p className="text-xs text-gray-500">
          {t("Usa Chrome. Instálala desde esta página con tu sesión de asociado abierta; así la app sólo aparece en tu celular.")}
        </p>
      </section>
      <Steps
        title={t("2. Compartir un anuncio de Facebook")}
        items={[
          t("Abre la publicación en Facebook o Marketplace."),
          t("Toma capturas: el texto completo, el precio, el contacto y cada foto abierta en grande."),
          t("Toca Compartir → Más opciones → Cabibee Asociados. Se abre Cabibee con el link. (O toca Copiar enlace y pégalo en Agregar anuncio.)"),
          t("Agrega las capturas en esa misma pantalla y toca Analizar."),
        ]}
      />
      <Steps
        title={t("Más rápido: compartir las capturas desde la galería")}
        items={[
          t("En Fotos o Galería, mantén presionada una captura y marca las demás del mismo anuncio."),
          t("Toca Compartir → Cabibee Asociados."),
          t("Cabibee se abre con las capturas cargadas: pega el link si lo tienes y toca Analizar."),
        ]}
      />
      <Steps
        title={t("Mercado Libre, Casas y Terrenos y Airbnb")}
        items={[
          t("En el anuncio toca Compartir → Cabibee Asociados (o copia el link)."),
          t("Con el puro link basta: Cabibee lee el texto y las fotos. Toca Analizar."),
          t("Trovit, Inmuebles24, Vivanuncios, Lamudi y otros bloquean a Cabibee: ahí comparte capturas como con Facebook."),
        ]}
      />
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-base font-semibold text-gray-900">{t("¿Qué sitios funcionan con el puro link?")}</h2>
        <SitesList />
      </section>
      <p className="text-xs text-gray-500">
        {t("¿No ves Cabibee Asociados en Compartir? Desliza la fila de apps hasta el final o toca Más. Si la acabas de instalar, espera un minuto.")}
      </p>
    </div>
  );

  const ios = (
    <div className="space-y-4">
      <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm leading-relaxed text-gray-700">
        {t("En iPhone, Apple no deja que las apps web aparezcan en el menú Compartir. Usa Agregar anuncio: pega el link o el texto y sube capturas desde tu galería.")}
      </p>
      <Steps
        title={t("Tener el panel como app en el iPhone")}
        items={[
          t("Abre esta página en Safari."),
          t("Toca Compartir (el cuadro con flecha) → Agregar a inicio → Agregar."),
          t("Abre Cabibee Asociados desde tu pantalla de inicio."),
        ]}
      />
    </div>
  );

  const desktop = (
    <div className="space-y-4">
      <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm leading-relaxed text-gray-700">
        {t("Estás en una computadora. Para recibir anuncios desde el botón Compartir, abre esta misma página en tu celular Android con tu cuenta de asociado:")}{" "}
        <strong>cabibee.com/asociados/celular</strong>
      </p>
      <p className="text-sm text-gray-600">
        {t("En la computadora usa la")}{" "}
        <Link href="/asociados/extension" className="font-medium text-amber-700 underline">
          {t("extensión de Chrome")}
        </Link>{" "}
        {t("o")}{" "}
        <Link href="/asociados/capturar" className="font-medium text-amber-700 underline">
          {t("Agregar anuncio")}
        </Link>
        .
      </p>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{t("Desde el celular")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          {t("Manda anuncios a Cabibee sin copiar nada: desde Facebook o tu galería tocas Compartir y eliges Cabibee Asociados. Sólo funciona con tu sesión de asociado abierta.")}
        </p>
      </div>
      {compartido === "sin-sesion" && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t("Tu sesión se había cerrado y lo que compartiste no se guardó. Ya entraste: compártelo otra vez.")}
        </p>
      )}
      {device === "android" ? android : device === "ios" ? ios : desktop}
      {device !== "android" && (
        <details className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-700">
          <summary className="cursor-pointer font-medium">{t("Ver los pasos para Android")}</summary>
          <div className="mt-4">{android}</div>
        </details>
      )}
    </div>
  );
}
