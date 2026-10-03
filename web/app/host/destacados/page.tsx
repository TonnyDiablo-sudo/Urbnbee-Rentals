import { FeaturedListingsPanel } from "@/components/host/featured-listings-panel";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Anuncios destacados") };
}

export default async function WebHostFeaturedPage() {
  const t = await getT();
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-1 text-2xl font-bold text-[#222]">{t("Anuncios destacados")}</h1>
      <p className="mb-6 text-sm text-[#717171]">
        {t("Los anuncios destacados aparecen antes que los demás en las búsquedas y llevan la etiqueta «Destacado».")}
      </p>
      <FeaturedListingsPanel />
    </div>
  );
}
