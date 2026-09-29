"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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
  const [rows, setRows] = useState<Listing[] | null>(null);
  const [acceptsBookings, setAcceptsBookings] = useState<boolean | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [l, s] = await Promise.all([
      fetch("/api/host/listings", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch("/api/host/verification/status", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
    ]);
    setRows(Array.isArray(l.listings) ? l.listings : []);
    if (typeof s.acceptsBookings === "boolean") setAcceptsBookings(s.acceptsBookings);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePublish = async (l: Listing) => {
    if (!l.published && (l.photos.length === 0 || !l.city.trim())) {
      setErr("Antes de publicar agrega al menos una foto y la ciudad. Toca «Editar».");
      return;
    }
    setBusyId(l.id);
    setErr(null);
    const res = await fetch(`/api/host/listings/${l.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !l.published }),
    }).catch(() => null);
    if (!res?.ok) setErr("No se pudo cambiar el estado.");
    setBusyId(null);
    await load();
  };

  if (rows === null) return <p className="px-5 py-6 text-sm text-[#999]">Cargando…</p>;

  return (
    <div className="px-5 pb-8">
      {acceptsBookings === false && rows.length > 0 && (
        <Link href="/host/motor" className="mb-4 block rounded-2xl bg-[#fdf6d8] px-4 py-3 text-sm text-[#5c4a0a]">
          Tus anuncios reciben mensajes, pero no reservas. <span className="font-semibold underline">Activa el motor de reservas</span>
        </Link>
      )}
      {err && <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}

      {rows.length === 0 ? (
        <div className="py-8">
          <p className="text-base font-semibold text-[#222]">Todavía no tienes anuncios</p>
          <p className="mt-1 text-sm text-[#717171]">Publicar es gratis. Empieza con fotos, precio y ciudad.</p>
          <Link
            href="/host/anuncios/nuevo"
            className="mt-5 inline-block rounded-xl bg-[#dcb81e] px-5 py-3 text-sm font-semibold text-black"
          >
            Crear mi primer anuncio
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((l) => (
            <li key={l.id} className="overflow-hidden rounded-2xl border border-[#ebebeb]">
              <div className="flex gap-3 p-3">
                <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-[#eee]">
                  {l.photos[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.photos[0]} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-[#222]">{l.title}</p>
                  <p className="truncate text-sm text-[#717171]">{[l.city, l.zone].filter(Boolean).join(", ") || "Sin ciudad"}</p>
                  <p className="text-sm text-[#333]">${l.pricePerNight.toLocaleString("es-MX")} MXN noche</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        l.published ? "bg-[#e6f6ea] text-[#1e7a3a]" : "bg-[#f1f1f1] text-[#717171]"
                      }`}
                    >
                      {l.published ? "Publicado" : "Borrador"}
                    </span>
                    {l.verified && (
                      <span className="rounded-full bg-[#fdf6d8] px-2 py-0.5 text-[11px] font-semibold text-[#8a6d0f]">
                        ✓ Verificado
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 border-t border-[#f0f0f0] text-sm font-medium">
                <Link href={`/host/anuncios/${l.id}`} className="py-3 text-center text-[#222]">
                  Editar
                </Link>
                <button
                  type="button"
                  disabled={busyId === l.id}
                  onClick={() => void togglePublish(l)}
                  className="border-x border-[#f0f0f0] py-3 text-[#222] disabled:opacity-50"
                >
                  {l.published ? "Pausar" : "Publicar"}
                </button>
                {l.published ? (
                  <Link href={`/alojamiento/${l.slug}`} className="py-3 text-center text-[#222]">
                    Ver
                  </Link>
                ) : (
                  <span className="py-3 text-center text-[#bbb]">Ver</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
