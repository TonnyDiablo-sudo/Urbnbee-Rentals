import "server-only";
import type { TFn } from "@/lib/i18n";
import { sizedImage } from "@/lib/image-url";
import { summarizeWishlist } from "@/lib/wishlist-view";
import type { Wishlist } from "@/lib/wishlists-store";
import { tripDates } from "./wishlist-grid";

/** Lo que ve quien recibe el enlace antes de entrar: quién lo invita y cuántos alojamientos hay, sin mostrarlos. */
export function TripInviteTeaser({ list, t, lang }: { list: Wishlist; t: TFn; lang: string }) {
  const s = summarizeWishlist(list, "");
  const dates = tripDates(t, lang, list.checkIn, list.checkOut);
  return (
    <div>
      <div className="relative grid aspect-[16/10] grid-cols-3 gap-0.5 overflow-hidden rounded-2xl bg-[#eee]">
        {[0, 1, 2].map((i) =>
          s.covers[i] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={sizedImage(s.covers[i], 320)} alt="" className="h-full w-full scale-110 object-cover blur-md" />
          ) : (
            <span key={i} className="block h-full w-full bg-[#e5e5e5]" />
          )
        )}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-[#222] shadow">
            🔒 {t(s.slugs.length === 1 ? "1 alojamiento" : "{n} alojamientos", { n: s.slugs.length })}
          </span>
        </span>
      </div>
      <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-[#b8931a]">{t("Te invitaron a un viaje")}</p>
      <h1 className="mt-1 text-2xl font-bold leading-tight text-[#222]">{list.name}</h1>
      <p className="mt-2 text-[15px] text-[#555]">
        {t("{name} quiere que veas los alojamientos que guardó y agregues los tuyos.", { name: s.people[0].name })}
        {dates && ` ${t("Fechas: {d}.", { d: dates })}`}
      </p>
    </div>
  );
}
