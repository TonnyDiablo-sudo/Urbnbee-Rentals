import Link from "next/link";
import { getShare } from "@/lib/associate-shares";
import { getT } from "@/lib/i18n/server";
import { findUserById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { CaptureForm, type SharedPreset } from "./capture-form";

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ host?: string; compartido?: string }>;
}) {
  const { host, compartido } = await searchParams;
  const t = await getT();
  const user = await getSessionUser();
  const target = host ? findUserById(host) : undefined;

  const share = user && compartido && /^[a-f0-9]{24}$/.test(compartido) ? await getShare(user.id, compartido) : null;
  const preset: SharedPreset | undefined = share
    ? { id: share.id, url: share.url, text: share.text, images: share.images.length, skipped: share.skipped }
    : undefined;
  const shareProblem =
    compartido && !share ? (compartido === "vacio" ? t("No llegó nada de lo compartido. Intenta de nuevo.") : t("Lo compartido ya no está disponible. Compártelo otra vez.")) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900">{t("Agregar anuncio")}</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        {t(
          "Pega el link del anuncio, su texto, sube capturas, o todo junto. Con más información la IA se equivoca menos. Después revisas el borrador antes de crear la cuenta."
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Link href="/asociados/celular" className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-800 hover:bg-amber-100">
          📱 {t("Compartir desde el celular")}
        </Link>
        <Link href="/asociados/extension" className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700 hover:bg-gray-200">
          💻 {t("Extensión para computadora")}
        </Link>
      </div>
      {preset && (
        <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          {t("Recibimos lo que compartiste. Revisa que esté completo y dale Analizar.")}
          {preset.skipped > 0 && ` ${t("{n} archivos no se pudieron usar.", { n: preset.skipped })}`}
        </p>
      )}
      {shareProblem && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{shareProblem}</p>}
      {target && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t("Este anuncio se agregará a la cuenta de")} <strong>{target.fullName}</strong>.
        </p>
      )}
      <CaptureForm hostId={target?.id} preset={preset} />
    </div>
  );
}
