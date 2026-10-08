import type { NextConfig } from "next";

/** Identifica cada deploy: la app compara el suyo con el del servidor para avisar que hay versión nueva. */
const buildId = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 12) || String(Date.now());

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  // En local la app se abre en http://app.localhost:3005 (ver middleware.ts).
  allowedDevOrigins: ["app.localhost"],
  // geoip-lite lee su base de datos desde su propia carpeta: no se puede empaquetar.
  serverExternalPackages: ["geoip-lite"],
  // Las pestañas de la app se precargan y, ya visitadas, se reusan unos segundos: cambiar de pestaña es instantáneo.
  experimental: { staleTimes: { dynamic: 30, static: 60 } },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/asociados-sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
