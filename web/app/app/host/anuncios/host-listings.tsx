"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { sizedImage } from "@/lib/image-url";

type Listing = {
  id: string;
  slug: string;
  title: string;
  city: string;
  zone: string;
  pricePerNight: number;
  photos: string[];
  published: boolean;
  verified: boolean;
};

export function HostListings() {
  const t = useT();
  const [rows, setRows] = useState<Listing[] | null>(null);
  const [acceptsBookings, setAcceptsBookings] = useState<boolean | null>(null);

  useEffect(() => {
    void Promise.all([
      fetch("/api/host/listings", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch("/api/host/verification/status", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
    ]).then(([l, s]) => {
      setRows(Array.isArray(l.listings) ? l.listings : []);
      if (typeof s.acceptsBookings === "boolean") setAcceptsBookings(s.acceptsBookings);
    });
  }, []);

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
        <ul className="space-y-6">
          {rows.map((l) => (
            <li key={l.id}>
              <Link href={`/host/anuncios/${l.id}`} className="block">
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[#eee]">
                  {l.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sizedImage(l.photos[0], 720)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-sm text-[#999]">{t("Sin fotos")}</span>
                  )}
                  <span
                    className={`absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-semibold shadow ${
                      l.published ? "text-[#1e7a3a]" : "text-[#717171]"
                    }`}
                  >
                    ● {l.published ? t("Publicado") : t("No publicado")}
                  </span>
                </div>
                <p className="mt-2.5 truncate text-[15px] font-semibold text-[#222]">{l.title}</p>
                <p className="truncate text-sm text-[#717171]">
                  {[l.zone, l.city].filter(Boolean).join(", ") || t("Sin ciudad")} · ${l.pricePerNight.toLocaleString("es-MX")}{" "}
                  {t("MXN noche")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
