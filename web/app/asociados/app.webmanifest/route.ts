/**
 * App instalable sólo para asociados: el enlace a este manifest sólo aparece dentro del
 * panel (con sesión), así que nadie más la instala ni ve "Cabibee Asociados" en Compartir.
 * Android la agrega al menú Compartir gracias a `share_target` (iPhone no lo soporta).
 */
export function GET() {
  return Response.json(
    {
      id: "/asociados",
      name: "Cabibee Asociados",
      short_name: "Cabibee Asoc.",
      description: "Comparte anuncios de Facebook, Marketplace o cualquier sitio y conviértelos en cuentas de Cabibee.",
      lang: "es-MX",
      start_url: "/asociados?source=pwa",
      scope: "/asociados",
      display: "standalone",
      orientation: "portrait",
      background_color: "#ffffff",
      theme_color: "#d97706",
      icons: [
        { src: "/app-icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/app-icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
      share_target: {
        action: "/asociados/compartir",
        method: "POST",
        enctype: "multipart/form-data",
        params: {
          title: "title",
          text: "text",
          url: "url",
          files: [{ name: "images", accept: ["image/*", ".jpg", ".jpeg", ".png", ".webp"] }],
        },
      },
      shortcuts: [
        { name: "Agregar anuncio", url: "/asociados/capturar", icons: [{ src: "/app-icons/icon-192.png", sizes: "192x192" }] },
        { name: "Mis cuentas", url: "/asociados/cuentas", icons: [{ src: "/app-icons/icon-192.png", sizes: "192x192" }] },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } }
  );
}
