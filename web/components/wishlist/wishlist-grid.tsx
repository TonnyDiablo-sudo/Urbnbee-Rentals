import Link from "next/link";
import type { TFn } from "@/lib/i18n";
import { sizedImage } from "@/lib/image-url";
import type { WishlistSummary } from "@/lib/wishlist-view";

export function tripDates(t: TFn, lang: string, checkIn?: string, checkOut?: string): string {
  const fmt = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(lang === "en" ? "en-US" : "es-MX", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  };
  if (checkIn && checkOut) return `${fmt(checkIn)} – ${fmt(checkOut)}`;
  if (checkIn) return t("Desde el {d}", { d: fmt(checkIn) });
  return "";
}

function Mosaic({ covers }: { covers: string[] }) {
  const [a, b, c] = covers;
  const img = (src: string | undefined, cls: string) =>
    src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={sizedImage(src, 480)} alt="" className={`h-full w-full object-cover ${cls}`} loading="lazy" />
    ) : (
      <span className={`block h-full w-full bg-[#ececec] ${cls}`} />
    );
  return (
    <div className="grid aspect-square grid-cols-[2fr_1fr] grid-rows-2 gap-0.5 overflow-hidden rounded-2xl bg-white">
      <div className="row-span-2">{img(a, "")}</div>
      <div>{img(b, "")}</div>
      <div>{img(c, "")}</div>
    </div>
  );
}

/** Cuadrícula de listas y viajes (favoritos). */
export function WishlistGrid({
  lists,
  t,
  lang,
  hrefBase,
  columns = "grid-cols-2",
}: {
  lists: WishlistSummary[];
  t: TFn;
  lang: string;
  hrefBase: string;
  columns?: string;
}) {
  return (
    <ul className={`grid gap-x-4 gap-y-6 ${columns}`}>
      {lists.map((l) => {
        const dates = tripDates(t, lang, l.checkIn, l.checkOut);
        const others = l.people.length - 1;
        return (
          <li key={l.id}>
            <Link href={`${hrefBase}/${l.id}`} className="block">
              <Mosaic covers={l.covers} />
              <p className="mt-2 truncate text-[15px] font-semibold text-[#222]">{l.name}</p>
              <p className="truncate text-[13px] text-[#717171]">
                {t(l.slugs.length === 1 ? "1 guardado" : "{n} guardados", { n: l.slugs.length })}
                {dates && ` · ${dates}`}
              </p>
              {l.people.length > 1 && (
                <p className="truncate text-[13px] text-[#717171]">
                  {l.isOwner
                    ? t(others === 1 ? "Compartida con 1 persona" : "Compartida con {n} personas", { n: others })
                    : t("De {name}", { name: l.people[0].name })}
                </p>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
