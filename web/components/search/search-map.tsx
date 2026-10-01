"use client";

import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { useT } from "@/components/i18n-provider";

export type SearchMapItem = {
  id: string;
  href: string;
  title: string;
  subtitle?: string;
  imageSrc: string;
  pricePerNight: number;
  rating?: number;
  identityVerified?: boolean;
  lat: number;
  lng: number;
};

type Props = {
  items: SearchMapItem[];
  /** Alto con CSS (ej. `calc(100dvh - 200px)`); si falta, ocupa hasta el final de la pantalla. */
  height?: string;
  /** Espacio que se deja abajo cuando el alto se calcula solo (barra de pestañas). */
  bottomReserve?: string;
  className?: string;
};

const MX_CENTER: [number, number] = [23.6345, -102.5528];

function pinHtml(price: number, active: boolean): string {
  const label = `$${price.toLocaleString("es-MX")}`;
  return `<span class="cb-map-pin${active ? " cb-map-pin--active" : ""}">${label}</span>`;
}

export function SearchMap({ items, height, bottomReserve = "0px", className = "" }: Props) {
  const t = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, { marker: Marker; price: number }>>(new Map());
  const [selected, setSelected] = useState<string | null>(null);
  const [top, setTop] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const selectedItem = items.find((i) => i.id === selected) ?? null;

  useEffect(() => {
    if (height || !boxRef.current) return;
    const measure = () => {
      if (boxRef.current) setTop(boxRef.current.getBoundingClientRect().top + window.scrollY);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [height]);

  useEffect(() => {
    let cancelled = false;
    const markers = markersRef.current;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !boxRef.current || mapRef.current) return;
      const map = L.map(boxRef.current, { zoomControl: false, attributionControl: true }).setView(MX_CENTER, 5);
      L.control.zoom({ position: "topright" }).addTo(map);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.on("click", () => setSelected(null));
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      for (const { marker } of markersRef.current.values()) marker.remove();
      markersRef.current.clear();
      const bounds = L.latLngBounds([]);
      for (const it of items) {
        const marker = L.marker([it.lat, it.lng], {
          icon: L.divIcon({ className: "cb-map-pin-wrap", html: pinHtml(it.pricePerNight, false), iconSize: [0, 0] }),
          keyboard: true,
          title: it.title,
        })
          .on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            setSelected(it.id);
          })
          .addTo(map);
        markersRef.current.set(it.id, { marker, price: it.pricePerNight });
        bounds.extend([it.lat, it.lng]);
      }
      if (items.length === 1) map.setView([items[0].lat, items[0].lng], 13);
      else if (items.length > 1) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
      map.invalidateSize();
    })();
    return () => {
      cancelled = true;
    };
  }, [items, ready]);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      const L = (await import("leaflet")).default;
      for (const [id, { marker, price }] of markersRef.current) {
        const active = id === selected;
        marker.setIcon(L.divIcon({ className: "cb-map-pin-wrap", html: pinHtml(price, active), iconSize: [0, 0] }));
        marker.setZIndexOffset(active ? 1000 : 0);
      }
    })();
  }, [selected, ready]);

  useEffect(() => {
    mapRef.current?.invalidateSize();
  }, [top]);

  const style = {
    height: height ?? (top === null ? "70vh" : `calc(100dvh - ${top}px - ${bottomReserve})`),
    minHeight: 320,
  };

  return (
    <div className={`relative isolate overflow-hidden ${className}`} style={style}>
      <div ref={boxRef} className="h-full w-full bg-[#e9eef0]" />
      {items.length === 0 && (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-[500] rounded-xl bg-white/95 px-4 py-3 text-center text-sm text-[#484848] shadow">
          {t("Ninguno de estos alojamientos tiene ubicación en el mapa todavía.")}
        </div>
      )}
      {selectedItem && (
        <div className="absolute inset-x-3 bottom-[68px] z-[500] mx-auto max-w-md">
          <Link
            href={selectedItem.href}
            className="flex gap-3 overflow-hidden rounded-2xl bg-white p-2 shadow-[0_6px_24px_rgba(0,0,0,0.25)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedItem.imageSrc} alt="" className="h-24 w-28 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0 flex-1 py-1 pr-7">
              {selectedItem.identityVerified && (
                <p className="text-[11px] font-semibold text-[#1e7a3a]">{t("✓ Identidad verificada")}</p>
              )}
              <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-[#222]">{selectedItem.title}</p>
              {selectedItem.subtitle && <p className="truncate text-sm text-[#717171]">{selectedItem.subtitle}</p>}
              <p className="mt-1 text-[15px] text-[#222]">
                <span className="font-semibold">${selectedItem.pricePerNight.toLocaleString("es-MX")} MXN</span>{" "}
                {t("noche")}
                {selectedItem.rating ? ` · ★ ${selectedItem.rating.toFixed(1)}` : ""}
              </p>
            </div>
          </Link>
          <button
            type="button"
            aria-label={t("Cerrar")}
            onClick={() => setSelected(null)}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-lg leading-none text-[#222] shadow"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
