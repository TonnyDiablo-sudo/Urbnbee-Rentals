import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Cabibee — Alojamientos verificados",
    short_name: "Cabibee",
    description:
      "Busca alojamientos, chatea con anfitriones y reserva con identidad verificada. Si eres anfitrión, atiende tus mensajes y solicitudes desde el celular.",
    lang: "es-MX",
    start_url: "/app?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#000000",
    categories: ["travel", "lifestyle"],
    icons: [
      { src: "/app-icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/app-icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Explorar", url: "/app", icons: [{ src: "/app-icons/icon-192.png", sizes: "192x192" }] },
      { name: "Mensajes", url: "/app/mensajes", icons: [{ src: "/app-icons/icon-192.png", sizes: "192x192" }] },
      { name: "Modo anfitrión", url: "/app/host", icons: [{ src: "/app-icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
