import { notFound } from "next/navigation";
import { PublicProfileView } from "@/components/profile/public-profile-view";
import { getLang, getT } from "@/lib/i18n/server";
import { publicProfileOf } from "@/lib/public-profile";
import { getSessionUser } from "@/lib/session";
import { TopBar } from "../../_components/top-bar";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const [{ id }, t] = await Promise.all([params, getT()]);
  return { title: publicProfileOf(id)?.name ?? t("Perfil") };
}

export default async function AppPublicProfilePage({ params }: Props) {
  const [{ id }, viewer, t, lang] = await Promise.all([params, getSessionUser(), getT(), getLang()]);
  const p = publicProfileOf(id);
  /** Los huéspedes sólo los ven quienes tienen sesión; los anfitriones con anuncio son públicos. */
  if (!p || (!p.listings.length && !viewer)) notFound();
  return (
    <>
      <TopBar title={t("Perfil")} back="/" />
      <div className="px-4 pt-4 sm:px-6">
        <PublicProfileView p={p} t={t} lang={lang} listingBase="/alojamiento" />
      </div>
    </>
  );
}
