/* App instalable del panel de asociados (cabibee.com/asociados).
 * No cachea nada: sólo existe para que Android la instale y la muestre en "Compartir".
 * Lo compartido llega como POST a /asociados/compartir y lo atiende el servidor. */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate" || event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(
          "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><body style='font:16px system-ui;padding:24px'><h1>Sin conexión</h1><p>Conéctate a internet y vuelve a abrir Cabibee Asociados.</p>",
          { headers: { "Content-Type": "text/html; charset=utf-8" } }
        )
    )
  );
});
