import Link from "next/link";
import { WebAuthButtons, WishlistWebShell } from "@/components/wishlist/web-shell";
import { WishlistGrid } from "@/components/wishlist/wishlist-grid";
import { getLang, getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { summarizeWishlist } from "@/lib/wishlist-view";
import { listWishlistsForUser } from "@/lib/wishlists-store";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Favoritos") };
}

export default async function WebWishlistsPage() {
  const [user, t, lang] = await Promise.all([getSessionUser(), getT(), getLang()]);
  const lists = user ? listWishlistsForUser(user.id).map((l) => summarizeWishlist(l, user.id)) : [];
  return (
    <WishlistWebShell>
      <h1 className="text-3xl font-semibold text-[#484848]">{t("Favoritos")}</h1>
      <div className="mt-2 h-1 w-16" style={{ backgroundColor: "#dcb81e" }} />
      {!user ? (
        <WebAuthButtons
          t={t}
          next="/favoritos"
          title="Guarda lo que te gusta"
          message="Con tu cuenta guardas alojamientos en listas, armas un viaje y lo compartes con quien va contigo."
        />
      ) : lists.length === 0 ? (
        <div className="mt-8 max-w-md">
          <p className="text-lg font-semibold text-[#222]">{t("Crea tu primera lista")}</p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#555]">
            {t("Toca el corazón ♡ en cualquier alojamiento para guardarlo. Haz una lista por viaje y compártela con un enlace.")}
          </p>
          <Link href="/alojamientos" className="mt-6 inline-block rounded bg-[#222] px-5 py-3 text-sm font-semibold text-white">
            {t("Explorar alojamientos")}
          </Link>
        </div>
      ) : (
        <div className="mt-8">
          <WishlistGrid lists={lists} t={t} lang={lang} hrefBase="/favoritos" columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
        </div>
      )}
    </WishlistWebShell>
  );
}
