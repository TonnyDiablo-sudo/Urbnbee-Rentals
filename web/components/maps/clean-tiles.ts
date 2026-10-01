import type { Map as LeafletMap } from "leaflet";

/**
 * Mapa gris, sin iconos de comercios ni puntos de interés.
 * Los mosaicos de Esri son de 256 px; en pantallas nítidas se pide el nivel
 * siguiente para que no se vean borrosos.
 */
export function addCleanTiles(L: typeof import("leaflet"), map: LeafletMap) {
  const opts = {
    maxZoom: 16,
    detectRetina: true,
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  };
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    opts
  ).addTo(map);
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    opts
  ).addTo(map);
}
