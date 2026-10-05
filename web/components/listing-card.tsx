"use client";

import Image from "next/image";
import Link from "next/link";
import type { Listing } from "@/lib/mock-data";
import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale } from "@/lib/i18n";
import { SaveHeart } from "@/components/wishlist/save-heart";

type Props = { listing: Listing };

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80";

export function ListingCard({ listing }: Props) {
  const t = useT();
  const lang = useLang();
  const imgSrc = listing.imageSrc?.trim() ? listing.imageSrc : FALLBACK_COVER;
  const fmt = (n: number) =>
    n.toLocaleString(numberLocale(lang), { maximumFractionDigits: n % 1 === 0 ? 0 : 1 });
  const price = listing.pricePerMonth
    ? `$ ${fmt(listing.pricePerMonth)} ${t("/ mes")}`
    : `$ ${fmt(listing.pricePerNight)} ${t("/noche")}`;

  return (
    <article className="group overflow-hidden bg-white shadow-sm transition hover:shadow-md" style={{ border: "1px solid #e8e8e8" }}>
      {/* Photo */}
      <Link href={`/listings/${listing.slug}`} className="relative block overflow-hidden" style={{ height: "220px" }}>
        <Image
          src={imgSrc}
          alt={listing.title}
          fill
          className="object-cover transition duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        {/* Price overlay */}
        <div
          className="absolute left-0 top-0 px-3 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: "#dcb81e" }}
        >
          {price}
        </div>
        {/* Badges */}
        <div className="absolute right-2 top-2 flex flex-col gap-1">
          {listing.identityVerified && (
            <span className="rounded bg-[#1e7a3a] px-2 py-0.5 text-xs font-semibold text-white">
              {t("✓ Identidad verificada")}
            </span>
          )}
          {listing.verified && !listing.identityVerified && (
            <span
              className="rounded px-2 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: "#dcb81e" }}
            >
              {t("Miembro verificado")}
            </span>
          )}
          {listing.featured && (
            <span
              className="rounded px-2 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: "#dcb81e" }}
            >
              {t("Destacado")}
            </span>
          )}
        </div>
        <SaveHeart slug={listing.slug} surface="web" className="absolute bottom-2 right-2" />
      </Link>

      {/* Info */}
      <div className="p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <Link href={`/listings/${listing.slug}`} className="flex-1">
            <h3
              className="text-base font-medium leading-snug text-[#484848] transition group-hover:text-[#dcb81e]"
            >
              {listing.title}
            </h3>
          </Link>
          {typeof listing.rating === "number" && listing.rating > 0 && (
            <span className="shrink-0 text-sm font-semibold" style={{ color: "#dcb81e" }}>
              {listing.rating.toFixed(2)}
            </span>
          )}
        </div>

        <p className="text-sm text-[#3a3a3a]">
          <span style={{ color: "#dcb81e" }}>{t((listing.categoryLabel || "").split(",")[0] || "—")}</span>
          {(listing.categoryLabel || "").includes(",") && (
            <>
              , <span style={{ color: "#dcb81e" }}>{t((listing.categoryLabel || "").split(",")[1].trim())}</span>
            </>
          )}
          {" · "}
          {t(listing.spaceType)}
        </p>

        <p className="mt-1 text-sm text-[#3a3a3a]">
          {t("{n} invitados", { n: listing.guests })} · {t("{n} recámaras", { n: listing.bedrooms })} · {t("{n} baños", { n: listing.bathrooms })}
        </p>

        <p className="mt-3 text-sm font-semibold" style={{ color: "#dcb81e" }}>
          {price}
        </p>
      </div>
    </article>
  );
}
