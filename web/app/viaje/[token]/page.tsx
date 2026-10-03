import Link from "next/link";
import { redirect } from "next/navigation";
import { TripInviteTeaser } from "@/components/wishlist/trip-invite";
import { WebAuthButtons, WishlistWebShell } from "@/components/wishlist/web-shell";
import { getLang, getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { WishlistError, getWishlistByToken, joinWishlistByToken } from "@/lib/wishlists-store";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Te invitaron a un viaje") };
}

export default async function WebTripInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, user, t, lang] = await Promise.all([params, getSessionUser(), getT(), getLang()]);
  const list = getWishlistByToken(token);
  if (!list) {
    return (
      <WishlistWebShell>
        <p className="text-lg font-semibold text-[#222]">{t("Este enlace ya no sirve")}</p>
        <p className="mt-2 text-[15px] text-[#555]">{t("Quien te lo mandó dejó de compartir la lista. Pídele un enlace nuevo.")}</p>
        <Link href="/alojamientos" className="mt-6 inline-block text-sm font-semibold underline">
          {t("Explorar alojamientos")}
        </Link>
      </WishlistWebShell>
    );
  }
  if (user) {
    let joined: string | null = null;
    let error: string | null = null;
    try {
      joined = joinWishlistByToken(token, user.id)?.id ?? null;
    } catch (e) {
      if (!(e instanceof WishlistError)) throw e;
      error = e.message;
    }
    if (joined) redirect(`/favoritos/${joined}`);
    return (
      <WishlistWebShell>
        <p className="text-[15px] text-[#555]">{t(error ?? "No encontramos esa lista.")}</p>
      </WishlistWebShell>
    );
  }
  return (
    <WishlistWebShell>
      <div className="max-w-xl">
        <TripInviteTeaser list={list} t={t} lang={lang} />
        <WebAuthButtons
          t={t}
          next={`/viaje/${token}`}
          title="Crea tu cuenta para ver el viaje"
          message="Es gratis. Al entrar verás los alojamientos sugeridos y podrás agregar los tuyos."
        />
      </div>
    </WishlistWebShell>
  );
}
