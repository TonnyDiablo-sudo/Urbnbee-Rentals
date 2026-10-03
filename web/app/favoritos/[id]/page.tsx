import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingCard } from "@/components/listing-card";
import { WebAuthButtons, WishlistWebShell } from "@/components/wishlist/web-shell";
import { WishlistActions } from "@/components/wishlist/wishlist-actions";
import { tripDates } from "@/components/wishlist/wishlist-grid";
import { webListingsBySlug } from "@/lib/app-listings";
import { getLang, getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { addedByName, summarizeWishlist } from "@/lib/wishlist-view";
import { canEditWishlist, getWishlist } from "@/lib/wishlists-store";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Favoritos") };
}

export default async function WebWishlistPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user, t, lang] = await Promise.all([params, getSessionUser(), getT(), getLang()]);
  if (!user) {
    return (
      <WishlistWebShell>
        <WebAuthButtons
          t={t}
          next={`/favoritos/${id}`}
          title="Inicia sesión para ver esta lista"
          message="Las listas son privadas: sólo las ven quienes están en ellas."
        />
      </WishlistWebShell>
    );
  }
  const list = getWishlist(id);
  if (!list || !canEditWishlist(list, user.id)) notFound();
  const summary = summarizeWishlist(list, user.id);
  const bySlug = webListingsBySlug();
  const cards = summary.slugs.flatMap((s) => {
    const c = bySlug.get(s);
    return c ? [c] : [];
  });
  const dates = tripDates(t, lang, list.checkIn, list.checkOut);

  return (
    <WishlistWebShell>
      <Link href="/favoritos" className="text-sm font-medium" style={{ color: "#dcb81e" }}>
        ← {t("Favoritos")}
      </Link>
      <h1 className="mt-3 text-3xl font-semibold text-[#484848]">{list.name}</h1>
      <p className="mt-2 text-sm text-[#717171]">
        {t(cards.length === 1 ? "1 guardado" : "{n} guardados", { n: cards.length })}
        {dates && ` · ${dates}`}
        {!summary.isOwner && ` · ${t("De {name}", { name: summary.people[0].name })}`}
      </p>
      <div className="mt-4">
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
        <div className="mt-10">
          <p className="text-base font-semibold text-[#222]">{t("Todavía no hay alojamientos")}</p>
          <p className="mt-1 text-sm text-[#717171]">{t("Busca y toca el corazón ♡ para agregarlos a esta lista.")}</p>
          <Link href="/alojamientos" className="mt-4 inline-block text-sm font-semibold underline">
            {t("Explorar alojamientos")}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => {
            const by = addedByName(list, c.slug, user.id);
            return (
              <div key={c.id}>
                <ListingCard listing={c} />
                {by && <p className="mt-1.5 text-[13px] text-[#717171]">{t("Lo agregó {name}", { name: t(by) })}</p>}
              </div>
            );
          })}
        </div>
      )}
    </WishlistWebShell>
  );
}
