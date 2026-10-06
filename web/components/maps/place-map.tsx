"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import { useT } from "@/components/i18n-provider";
import { addCleanTiles } from "./clean-tiles";

/** Mapa de un anuncio: centrado en el punto y cerca, con un círculo en vez de un pin cargado. */
export function PlaceMap({
  lat,
  lng,
  zoom = 15,
  className = "",
  interactive = true,
  exact = false,
}: {
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
  interactive?: boolean;
  /** Exacta: punto. Aproximada: sólo un círculo amplio (las coordenadas ya vienen corridas del servidor). */
  exact?: boolean;
}) {
  const t = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const backToListing = () => mapRef.current?.flyTo([lat, lng], zoom, { duration: 0.6 });

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || mapRef.current) return;
      const map = L.map(box, {
        zoomControl: interactive,
        attributionControl: true,
        scrollWheelZoom: interactive,
        dragging: interactive,
        doubleClickZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
        touchZoom: interactive,
      }).setView([lat, lng], zoom);
      addCleanTiles(L, map);
      if (exact) {
        L.circleMarker([lat, lng], {
          radius: 9,
          color: "#fff",
          weight: 3,
          fillColor: "#222",
          fillOpacity: 1,
        }).addTo(map);
      } else {
        L.circle([lat, lng], {
          radius: 450,
          color: "#c9a71a",
          weight: 1,
          fillColor: "#dcb81e",
          fillOpacity: 0.28,
        }).addTo(map);
      }
      mapRef.current = map;
      requestAnimationFrame(() => map.invalidateSize());
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lat, lng, zoom, interactive, exact]);

  return (
    <div className={`relative isolate h-full w-full ${className}`}>
      <div ref={boxRef} className="h-full w-full bg-[#eceae6]" />
      {interactive && (
        <button
          type="button"
          onClick={backToListing}
          className="absolute bottom-3 left-3 z-[500] rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-[#222] shadow-[0_2px_10px_rgba(0,0,0,0.2)]"
        >
          {t("Volver al anuncio")}
        </button>
      )}
    </div>
  );
}
