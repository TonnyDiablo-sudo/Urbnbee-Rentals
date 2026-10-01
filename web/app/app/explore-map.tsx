"use client";

import { LazySearchMap } from "@/components/search/search-map-lazy";
import type { SearchMapItem } from "@/components/search/search-map";

/** Mapa a pantalla completa entre la barra de búsqueda y las pestañas. */
export function ExploreMap({ items }: { items: SearchMapItem[] }) {
  return <LazySearchMap items={items} bottomReserve="64px - env(safe-area-inset-bottom)" />;
}
