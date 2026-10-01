"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import { addCleanTiles } from "./clean-tiles";

/** Mapa de un anuncio: centrado en el punto y cerca, con un círculo en vez de un pin cargado. */
export function PlaceMap({
  lat,
  lng,
  zoom = 15,
  className = "",
  interactive = true,
}: {
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
  interactive?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

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
      L.circle([lat, lng], {
        radius: 280,
        color: "#c9a71a",
        weight: 1,
        fillColor: "#dcb81e",
        fillOpacity: 0.28,
      }).addTo(map);
      L.circleMarker([lat, lng], {
        radius: 7,
        color: "#fff",
        weight: 2,
        fillColor: "#222",
        fillOpacity: 1,
      }).addTo(map);
      mapRef.current = map;
      requestAnimationFrame(() => map.invalidateSize());
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lat, lng, zoom, interactive]);

  return <div ref={boxRef} className={`h-full w-full bg-[#eceae6] ${className}`} />;
}
