import { notFound } from "next/navigation";
import { PublicProfileView } from "@/components/profile/public-profile-view";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getLang, getT } from "@/lib/i18n/server";
import { publicProfileOf } from "@/lib/public-profile";
import { getSessionUser } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const [{ id }, t] = await Promise.all([params, getT()]);
  return { title: publicProfileOf(id)?.name ?? t("Perfil") };
}

export default async function PublicProfilePage({ params }: Props) {
  const [{ id }, viewer, t, lang] = await Promise.all([params, getSessionUser(), getT(), getLang()]);
  const p = publicProfileOf(id);
  /** Los huéspedes sólo los ven quienes tienen sesión; los anfitriones con anuncio son públicos. */
  if (!p || (!p.listings.length && !viewer)) notFound();
  return (
    <>
      <SiteHeader />
      <main className="px-4 pb-10 sm:px-6" style={{ paddingTop: 96 }}>
        <PublicProfileView p={p} t={t} lang={lang} listingBase="/listings" />
      </main>
      <SiteFooter />
    </>
  );
}
