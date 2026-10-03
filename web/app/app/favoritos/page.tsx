import Link from "next/link";
import { WishlistGrid } from "@/components/wishlist/wishlist-grid";
import { getLang, getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { summarizeWishlist } from "@/lib/wishlist-view";
import { listWishlistsForUser } from "@/lib/wishlists-store";
import { AuthGate } from "../_components/auth-gate";
import { TabHeader } from "../_components/top-bar";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Favoritos") };
}

export default async function AppWishlistsPage() {
  const [user, t, lang] = await Promise.all([getSessionUser(), getT(), getLang()]);
  if (!user) {
    return (
      <>
        <TabHeader title={t("Favoritos")} />
        <AuthGate
          title="Guarda lo que te gusta"
          message="Con tu cuenta guardas alojamientos en listas, armas un viaje y lo compartes con quien va contigo."
          next="/favoritos"
        />
      </>
    );
  }
  const lists = listWishlistsForUser(user.id).map((l) => summarizeWishlist(l, user.id));
  return (
    <>
      <TabHeader title={t("Favoritos")} subtitle={lists.length ? t("Tus listas y viajes") : undefined} />
      <div className="px-5 pb-10 pt-2">
        {lists.length === 0 ? (
          <div className="py-10">
            <p className="text-lg font-semibold text-[#222]">{t("Crea tu primera lista")}</p>
            <p className="mt-2 text-[15px] leading-relaxed text-[#555]">
              {t("Toca el corazón ♡ en cualquier alojamiento para guardarlo. Haz una lista por viaje y compártela con un enlace.")}
            </p>
            <Link href="/" className="mt-6 inline-block rounded-xl bg-[#222] px-5 py-3 text-[15px] font-semibold text-white">
              {t("Explorar alojamientos")}
            </Link>
          </div>
        ) : (
          <WishlistGrid lists={lists} t={t} lang={lang} hrefBase="/favoritos" />
        )}
      </div>
    </>
  );
}
