import Link from "next/link";
import { redirect } from "next/navigation";
import { TripInviteTeaser } from "@/components/wishlist/trip-invite";
import { getLang, getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { WishlistError, getWishlistByToken, joinWishlistByToken } from "@/lib/wishlists-store";
import { AuthGate } from "../../_components/auth-gate";
import { TopBar } from "../../_components/top-bar";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Te invitaron a un viaje") };
}

export default async function AppTripInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, user, t, lang] = await Promise.all([params, getSessionUser(), getT(), getLang()]);
  const list = getWishlistByToken(token);
  if (!list) {
    return (
      <>
        <TopBar title={t("Viaje compartido")} back="/" />
        <div className="px-6 py-12">
          <p className="text-lg font-semibold text-[#222]">{t("Este enlace ya no sirve")}</p>
          <p className="mt-2 text-[15px] text-[#555]">{t("Quien te lo mandó dejó de compartir la lista. Pídele un enlace nuevo.")}</p>
          <Link href="/" className="mt-6 inline-block text-sm font-semibold underline">
            {t("Explorar alojamientos")}
          </Link>
        </div>
      </>
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
      <>
        <TopBar title={t("Viaje compartido")} back="/" />
        <p className="px-6 py-12 text-[15px] text-[#555]">{t(error ?? "No encontramos esa lista.")}</p>
      </>
    );
  }
  return (
    <>
      <TopBar title={t("Viaje compartido")} back="/" />
      <div className="px-5 pt-5">
        <TripInviteTeaser list={list} t={t} lang={lang} />
      </div>
      <AuthGate
        title="Crea tu cuenta para ver el viaje"
        message="Es gratis. Al entrar verás los alojamientos sugeridos y podrás agregar los tuyos."
        next={`/viaje/${token}`}
      />
    </>
  );
}
