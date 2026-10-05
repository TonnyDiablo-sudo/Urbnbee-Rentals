import Link from "next/link";
import { SaveHeart } from "@/components/wishlist/save-heart";
import type { AppListingCard } from "@/lib/app-listings";
import type { TFn } from "@/lib/i18n";
import { sizedImage } from "@/lib/image-url";
import { IconStar } from "./icons";

export function AppListingCardView({
  listing: l,
  t,
  priority = false,
  note,
}: {
  listing: AppListingCard;
  t: TFn;
  priority?: boolean;
  /** Línea extra debajo del precio (p. ej. quién lo agregó a un viaje). */
  note?: string;
}) {
  const place = [l.city, l.zone].filter((s) => s && /[\p{L}\p{N}]/u.test(s)).join(", ");
  return (
    <Link href={`/alojamiento/${l.slug}`} className="block">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#eee]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sizedImage(l.imageSrc, 720)}
          alt=""
          className="h-full w-full object-cover"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {l.featured && (
            <span className="rounded-full bg-[#222] px-2.5 py-1 text-[11px] font-semibold text-white shadow">
              {t("Destacado")}
            </span>
          )}
          {l.identityVerified ? (
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1e7a3a] shadow">
              {t("✓ Identidad verificada")}
            </span>
          ) : l.verified ? (
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#222] shadow">
              {t("✓ Miembro verificado")}
            </span>
          ) : null}
          {l.bookable && (
            <span className="rounded-full bg-[#dcb81e] px-2.5 py-1 text-[11px] font-semibold text-black shadow">
              {t("Reserva protegida por contrato")}
            </span>
          )}
        </div>
        <SaveHeart slug={l.slug} surface="app" className="absolute right-2 top-2" />
      </div>
      <div className="mt-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-[#222]">{place || l.title}</p>
          <p className="truncate text-sm text-[#717171]">{place ? l.title : t(l.spaceType)}</p>
          <p className="text-sm text-[#717171]">
            {t(l.guests === 1 ? "{n} huésped" : "{n} huéspedes", { n: l.guests })} ·{" "}
            {t(l.bedrooms === 1 ? "{n} recámara" : "{n} recámaras", { n: l.bedrooms })}
          </p>
        </div>
        {l.rating > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-sm text-[#222]">
            <IconStar />
            {l.rating.toFixed(1)}
          </span>
        )}
      </div>
      <p className="mt-1 text-[15px] text-[#222]">
        {l.pricePerMonth ? (
          <>
            <span className="font-semibold">${l.pricePerMonth.toLocaleString("es-MX")} MXN</span> {t("/ mes")}
          </>
        ) : (
          <>
            <span className="font-semibold">${l.pricePerNight.toLocaleString("es-MX")} MXN</span> {t("noche")}
          </>
        )}
      </p>
      {note && <p className="mt-0.5 text-[13px] text-[#717171]">{note}</p>}
    </Link>
  );
}
