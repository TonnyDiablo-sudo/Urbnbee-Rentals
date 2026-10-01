"use client";

import dynamic from "next/dynamic";

/** Leaflet sólo funciona en el navegador: se carga aparte y sin SSR. */
export const LazySearchMap = dynamic(() => import("./search-map").then((m) => m.SearchMap), {
  ssr: false,
  loading: () => <div className="h-[70vh] w-full animate-pulse bg-[#eef1f2]" />,
});
