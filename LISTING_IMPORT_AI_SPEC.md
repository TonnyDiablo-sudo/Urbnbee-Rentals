# Importación asistida de listings — solo screenshots

Especificación para implementar la opción **Asistido por IA** en el panel anfitrión. **No** incluye scraping ni fetch de URLs de Airbnb, Facebook Marketplace u otras plataformas.

---

## Decisión de producto

| Opción | Estado |
|--------|--------|
| **Manual** | El host crea un borrador vacío y completa todo en el editor (flujo actual). |
| **Asistido (screenshots)** | El host sube capturas de **su propio** anuncio (en otra web o app) y un LLM con visión extrae datos para **prellenar** un borrador. El host **revisa y edita** antes de publicar. |
| **URL / scraping** | **Fuera de alcance** — no abrir ni scrapear sitios de terceros desde el servidor. |

Motivo: evitar violación de ToS, bloqueos, reclamos de copyright y responsabilidad por datos de terceros.

---

## UX

### Entrada

Desde **Mis alojamientos** (`/host/listings`):

- Botón **+ Nuevo** → `/host/listings/new` con dos tarjetas:
  - **Manual** → crea borrador → `/host/listings/[id]/edit` (como hoy).
  - **Asistido con capturas** → `/host/listings/import`.

### Pantalla import (`/host/listings/import`)

1. **Consentimiento** (checkbox obligatorio, una vez por sesión o cada import):
   - Soy el anfitrión o tengo permiso para usar esta información en Urbnbee.
   - Las capturas son de **mi** anuncio (o contenido que tengo derecho a republicar).
   - Entiendo que debo **revisar** los datos generados; la IA puede equivocarse en precios, dirección o reglas.
   - Las **fotos publicadas** en Urbnbee las subiré yo en el editor (no se copian automáticamente imágenes de otras plataformas sin mi confirmación).

2. **Subir capturas**
   - Drag & drop + selector de archivos.
   - Formatos: JPEG, PNG, WebP.
   - Límites (anti-abuso):
     - Máx. **6 imágenes** por importación.
     - Máx. **5 MB** por imagen.
     - Máx. **25 MB** total por request.

3. **Opcional:** campo de texto “Notas o descripción que quieras que tengamos en cuenta” (texto pegado por el usuario, no scrape).

4. Botón **Analizar capturas** → loading → redirige a `/host/listings/[id]/edit` con campos prellenados.

5. Banner en editor: “Borrador generado con IA — revisa precio, ubicación y reglas antes de publicar.”

### Qué NO mostrar

- Campo “URL de Airbnb / Facebook” que implique importación automática desde el enlace.
- Mensajes del tipo “importamos desde Airbnb”.

Texto permitido (ayuda): “Sube capturas de pantalla de tu anuncio en otra plataforma (por ejemplo la página de tu listing). Nosotros **no** accedemos a tu cuenta ni a sitios externos.”

---

## Datos a extraer (JSON → `HostListingRecord`)

El modelo devuelve **solo JSON** (sin markdown), validado en servidor:

| Campo | Notas |
|-------|--------|
| title, description | Obligatorios si hay suficiente info |
| pricePerNight, cleaningFee | Número; si ambiguo → null + warning |
| guests, bedrooms, bathrooms | Enteros |
| city, zone, county, country, addressLine | Sin inventar coordenadas exactas |
| categoryKey, spaceType | Inferencia con `confidence` baja |
| amenities | Array de strings |
| rules | smoking, pets, parties, children (boolean) |
| photos | **No** en v1: el host sube fotos en el editor |

Campos con `confidence: "high" | "low"` opcionales en respuesta para resaltar en UI.

---

## API

### `POST /api/host/listings/import/analyze`

- Auth: host o admin (`requireHostUser`).
- Body: `multipart/form-data`
  - `images[]` (1–6 archivos)
  - `notes` (string opcional, max 4k chars)
  - `consentAccepted` (boolean, debe ser true)
- Rate limit: p. ej. 5 req / hora / hostId (implementar con mapa en memoria o Redis futuro; v1: simple contador en memoria con advertencia de 1 réplica).
- Response 200:
  ```json
  {
    "listing": { /* borrador parcial */ },
    "warnings": ["No se pudo leer el precio con claridad."],
    "fieldConfidence": { "pricePerNight": "low" }
  }
  ```
- Errores: 400 validación, 401, 413 tamaño, 429 rate limit, 502 LLM.

### `POST /api/host/listings/import/confirm`

- Body: JSON con borrador editado por el cliente (o reutilizar analyze que ya crea listing en servidor — preferible **analyze crea borrador** y devuelve `listingId` para simplificar).

**Flujo recomendado:** `analyze` crea listing en estado `published: false`, aplica campos extraídos, redirige a edit. No segunda llamada confirm salvo que el cliente edite antes de guardar en edit (ya existe PATCH listing).

---

## LLM

- Reutilizar infra de API key: `OPENAI_API_KEY` / `BLOG_BOT_OPENAI_API_KEY` / config admin (mismo patrón que `lib/blog-bot-generate.ts`).
- Modelo: **gpt-4o** o **gpt-4o-mini** con soporte imagen (vision).
- Timeout: 90s.
- Imágenes: base64 en mensaje user; orden estable.
- System prompt: rol “extraer datos de alojamiento para Urbnbee”, español México, no inventar dirección GPS, no datos de huéspedes, JSON schema fijo.
- Tras respuesta: `JSON.parse` + validación Zod/manual como blog bot.

**No persistir** imágenes subidas tras el análisis (borrar temp en `/tmp` o memoria); solo el borrador en `marketplace-store.json`.

---

## Seguridad y abuso

- Solo usuarios autenticados host/admin.
- Validar MIME y magic bytes.
- Límites de cantidad y tamaño (arriba).
- Log admin: `hostId`, timestamp, imageCount, tokens aproximados (sin guardar imágenes).
- Feature flag: `LISTING_IMPORT_AI_ENABLED=true` en env (opcional, default off en dev hasta listo).

---

## Implementación por fases

| Fase | Entregable |
|------|------------|
| 1 | UI `/host/listings/new` dos tarjetas + `/host/listings/import` con consent + upload |
| 2 | `POST analyze` + `listing-import-llm.ts` + redirect a edit prellenado |
| 3 | Warnings / confidence en editor |
| 4 | Rate limits + métricas en admin logs |

---

## Archivos a tocar (referencia)

- `web/app/host/listings/page.tsx` — enlace a nueva ruta
- `web/app/host/listings/new/page.tsx` — pantalla elección
- `web/app/host/listings/import/page.tsx` — nuevo
- `web/app/api/host/listings/import/analyze/route.ts` — nuevo
- `web/lib/listing-import-llm.ts` — nuevo
- `web/lib/marketplace-store.ts` — `createListing` con partial
- `web/.env.example` — `LISTING_IMPORT_AI_ENABLED`, límites opcionales

---

## Relación con otros docs

- Producto general: `URBNBEE_TRUST_MARKETPLACE_BRIEF.md`
- Handoff técnico: `URBNBEE_AI_HANDOFF.md`
