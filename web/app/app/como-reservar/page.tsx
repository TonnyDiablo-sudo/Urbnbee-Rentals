import { HowToBook } from "@/components/guides/how-to-book";
import { getT } from "@/lib/i18n/server";
import { TopBar } from "../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Cómo reservar") };
}

export default async function AppHowToBookPage() {
  const t = await getT();
  return (
    <>
      <TopBar title={t("Cómo reservar")} back="/perfil" />
      <div className="px-5 pb-12 pt-3">
        <HowToBook exploreHref="/" membershipHref="/membresia" />
      </div>
    </>
  );
}
