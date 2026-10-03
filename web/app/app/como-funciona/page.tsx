import { HowItWorks } from "@/components/guides/how-it-works";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Qué es Cabibee y cómo funciona") };
}

export default async function AppHowItWorksPage() {
  const t = await getT();
  return (
    <>
      <TopBar title={t("Qué es Cabibee y cómo funciona")} back="/perfil" />
      <div className="px-5 pb-12 pt-3">
        <HowItWorks exploreHref="/" bookHref="/como-reservar" storeHref="/tienda" />
      </div>
    </>
  );
}
