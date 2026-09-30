import Link from "next/link";
import { listingImportAiEnabled } from "@/lib/listing-import-limits";
import { getT } from "@/lib/i18n/server";

export default async function NewListingChoicePage() {
  const aiEnabled = listingImportAiEnabled();
  const t = await getT();

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-4">
      <div>
        <h1 className="text-2xl font-semibold text-[#484848]">{t("Nuevo alojamiento")}</h1>
        <p className="mt-2 text-sm text-[#888]">{t("Elige cómo quieres empezar.")}</p>
      </div>

      <div className={`grid gap-4 ${aiEnabled ? "sm:grid-cols-2" : "max-w-md"}`}>
        <Link
          href="/host/listings/new/manual"
          className="flex flex-col rounded-xl border-2 border-[#ebebeb] bg-white p-6 shadow-sm transition hover:border-black hover:shadow-md"
        >
          <span className="text-lg font-semibold text-[#222]">{t("Manual")}</span>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-[#666]">
            {t("Creas un borrador vacío y completas fotos, descripción, ubicación y precio tú mismo.")}
          </p>
          <span className="mt-4 text-sm font-semibold text-[#dcb81e]">{t("Continuar →")}</span>
        </Link>

        {aiEnabled ? (
          <Link
            href="/host/listings/import"
            className="flex flex-col rounded-xl border-2 border-[#dcb81e]/50 bg-amber-50/40 p-6 shadow-sm transition hover:border-[#dcb81e] hover:shadow-md"
          >
            <span className="text-lg font-semibold text-[#222]">{t("Asistido con capturas")}</span>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-[#666]">
              {t(
                "Sube capturas de pantalla de tu anuncio en otra plataforma. La IA prellena el borrador; tú revisas antes de publicar."
              )}
            </p>
            <span className="mt-4 text-sm font-semibold text-amber-900">{t("Usar capturas →")}</span>
          </Link>
        ) : (
          <div className="rounded-xl border border-dashed border-[#ddd] bg-[#fafafa] p-6 text-sm text-[#888]">
            {t("Importación con IA deshabilitada. Configura")} <code className="text-xs">OPENAI_API_KEY</code>{" "}
            {t("en el servidor.")}
          </div>
        )}
      </div>

      <Link href="/host/listings" className="inline-block text-sm text-[#888] hover:text-[#484848]">
        {t("← Volver a mis alojamientos")}
      </Link>
    </div>
  );
}
