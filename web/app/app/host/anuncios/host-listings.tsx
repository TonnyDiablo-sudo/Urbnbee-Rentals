"use client";

import Link from "next/link";
import { useT } from "@/components/i18n-provider";
import { sizedImage } from "@/lib/image-url";
import { useCached } from "../../_components/cached-fetch";
import { HOST_URLS, useHostListings, type ListingBadges } from "../_shared/host-data";

type Listing = {
  id: string;
  slug: string;
  title: string;
  city: string;
  zone: string;
  pricePerNight: number;
  rentalMode?: "nightly" | "monthly";
  pricePerMonth?: number;
  photos: string[];
  published: boolean;
  verified: boolean;
  badges?: ListingBadges;
};

const BADGES: { key: keyof ListingBadges; on: string; name: string; cls: string }[] = [
  { key: "identity", on: "✓ ID verificada", name: "ID verificada", cls: "bg-white text-[#1e7a3a]" },
  { key: "location", on: "📍 Dirección verificada", name: "Dirección verificada", cls: "bg-white text-[#1d4f91]" },
  { key: "bookable", on: "Reserva con Cabibee", name: "Reserva con Cabibee", cls: "bg-[#dcb81e] text-black" },
];

export function HostListings() {
  const t = useT();
  const rows: Listing[] | null = useHostListings();
  const status = useCached<{ acceptsBookings?: boolean }>(HOST_URLS.status).data;
  const acceptsBookings = typeof status?.acceptsBookings === "boolean" ? status.acceptsBookings : null;

  if (rows === null) return <p className="px-5 py-6 text-sm text-[#999]">{t("Cargando…")}</p>;

  return (
    <div className="px-5 pb-8">
      {acceptsBookings === false && rows.length > 0 && (
        <Link href="/host/motor" className="mb-4 block rounded-2xl bg-[#fdf6d8] px-4 py-3 text-sm text-[#5c4a0a]">
          {t("Tus anuncios reciben mensajes, pero no reservas.")}{" "}
          <span className="font-semibold underline">{t("Activa Reservas en línea")}</span>
        </Link>
      )}

      {rows.length === 0 ? (
        <div className="py-8">
          <p className="text-base font-semibold text-[#222]">{t("Todavía no tienes anuncios")}</p>
          <p className="mt-1 text-sm text-[#717171]">{t("Publicar es gratis. Empieza con fotos, precio y ciudad.")}</p>
          <Link
            href="/host/anuncios/nuevo"
            className="mt-5 inline-block rounded-xl bg-[#dcb81e] px-5 py-3 text-sm font-semibold text-black"
          >
            {t("Crear mi primer anuncio")}
          </Link>
        </div>
      ) : (
        <ul className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((l) => (
            <li key={l.id}>
              <Link href={`/host/anuncios/${l.id}`} prefetch className="block">
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[#eee]">
                  {l.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sizedImage(l.photos[0], 720)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-sm text-[#999]">{t("Sin fotos")}</span>
                  )}
                  <div className="absolute left-3 right-3 top-3 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full bg-white px-3 py-1 text-xs font-semibold shadow ${
                        l.published ? "text-[#1e7a3a]" : "text-[#717171]"
                      }`}
                    >
                      ● {l.published ? t("Publicado") : t("No publicado")}
                    </span>
                    {BADGES.filter((b) => l.badges?.[b.key]).map((b) => (
                      <span key={b.key} className={`rounded-full px-3 py-1 text-xs font-semibold shadow ${b.cls}`}>
                        {t(b.on)}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="mt-2.5 truncate text-[15px] font-semibold text-[#222]">{l.title}</p>
                <p className="truncate text-sm text-[#717171]">
                  {[l.zone, l.city].filter(Boolean).join(", ") || t("Sin ciudad")} ·{" "}
                  {l.rentalMode === "monthly" && l.pricePerMonth
                    ? `$${l.pricePerMonth.toLocaleString("es-MX")} ${t("MXN al mes")}`
                    : `$${l.pricePerNight.toLocaleString("es-MX")} ${t("MXN noche")}`}
                </p>
                {l.badges && BADGES.some((b) => !l.badges![b.key]) && (
                  <p className="mt-0.5 text-xs text-[#999]">
                    {t("Falta: {list}", {
                      list: BADGES.filter((b) => !l.badges![b.key])
                        .map((b) => t(b.name))
                        .join(" · "),
                    })}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
