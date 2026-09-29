import Link from "next/link";
import type { AppListingCard } from "@/lib/app-listings";
import { IconStar } from "./icons";

export function AppListingCardView({ listing: l }: { listing: AppListingCard }) {
  const place = [l.city, l.zone].filter(Boolean).join(", ");
  return (
    <Link href={`/alojamiento/${l.slug}`} className="block">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#eee]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={l.imageSrc} alt="" className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {l.verified && (
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#222] shadow">
              ✓ Miembro verificado
            </span>
          )}
          {l.bookable && (
            <span className="rounded-full bg-[#dcb81e] px-2.5 py-1 text-[11px] font-semibold text-black shadow">
              Reserva en Cabibee
            </span>
          )}
        </div>
      </div>
      <div className="mt-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-[#222]">{place || l.title}</p>
          <p className="truncate text-sm text-[#717171]">{place ? l.title : l.spaceType}</p>
          <p className="text-sm text-[#717171]">
            {l.guests} huéspedes · {l.bedrooms} {l.bedrooms === 1 ? "recámara" : "recámaras"}
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
        <span className="font-semibold">${l.pricePerNight.toLocaleString("es-MX")} MXN</span> noche
      </p>
    </Link>
  );
}
