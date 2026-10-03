import Link from "next/link";
import { notFound } from "next/navigation";
import { WishlistActions } from "@/components/wishlist/wishlist-actions";
import { tripDates } from "@/components/wishlist/wishlist-grid";
import { appListingsBySlug } from "@/lib/app-listings";
import { getLang, getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { addedByName, summarizeWishlist } from "@/lib/wishlist-view";
import { canEditWishlist, getWishlist } from "@/lib/wishlists-store";
import { AuthGate } from "../../_components/auth-gate";
import { AppListingCardView } from "../../_components/listing-card";
import { TopBar } from "../../_components/top-bar";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Favoritos") };
}

export default async function AppWishlistPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user, t, lang] = await Promise.all([params, getSessionUser(), getT(), getLang()]);
  if (!user) {
    return (
      <>
        <TopBar title={t("Favoritos")} back="/favoritos" />
        <AuthGate title="Inicia sesión para ver esta lista" message="Las listas son privadas: sólo las ven quienes están en ellas." next={`/favoritos/${id}`} />
      </>
    );
  }
  const list = getWishlist(id);
  if (!list || !canEditWishlist(list, user.id)) notFound();
  const summary = summarizeWishlist(list, user.id);
  const bySlug = appListingsBySlug();
  const cards = summary.slugs.flatMap((s) => {
    const c = bySlug.get(s);
    return c ? [c] : [];
  });
  const dates = tripDates(t, lang, list.checkIn, list.checkOut);

  return (
    <>
      <TopBar title={list.name} back="/favoritos" />
      <div className="px-5 pb-10 pt-4">
        <p className="text-sm text-[#717171]">
          {t(cards.length === 1 ? "1 guardado" : "{n} guardados", { n: cards.length })}
          {dates && ` · ${dates}`}
          {!summary.isOwner && ` · ${t("De {name}", { name: summary.people[0].name })}`}
        </p>
        <div className="mt-3">
          <WishlistActions
            id={list.id}
            name={list.name}
            checkIn={list.checkIn}
            checkOut={list.checkOut}
            isOwner={summary.isOwner}
            people={summary.people}
            shared={summary.shared}
            backHref="/favoritos"
          />
        </div>
        {cards.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-base font-semibold text-[#222]">{t("Todavía no hay alojamientos")}</p>
            <p className="mt-1 text-sm text-[#717171]">{t("Busca y toca el corazón ♡ para agregarlos a esta lista.")}</p>
            <Link href="/" className="mt-4 inline-block text-sm font-semibold underline">
              {t("Explorar alojamientos")}
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-7">
            {cards.map((c, i) => {
              const by = addedByName(list, c.slug, user.id);
              return (
                <AppListingCardView
                  key={c.id}
                  listing={c}
                  t={t}
                  priority={i === 0}
                  note={by ? t("Lo agregó {name}", { name: t(by) }) : undefined}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
