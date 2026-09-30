# Nota para el agente de Cabibee — integración con urbnbeeai (tool "Cabibee")

**Fecha:** 2026-09-29
**De:** agente de urbnbeeai (repo `beeagent-ui`), con decisiones del founder tomadas el mismo día.
**Para:** el agente que mantiene este repo (`Urbnbee-Rentals`, app en `web/`).
**Estado:** contrato acordado con el founder. Sustituye a `OPINION_REVIEW_BEEAGENT_CODEX_DOCS.md` y al contrato viejo de urbnbee.net donde choquen.

Esta nota dice qué hay que cambiar en Cabibee para que el agente IA de urbnbeeai pueda vender las propiedades del anfitrión, revisar disponibilidad, mandar ligas, confirmar reservas y pagos, y avisarle al anfitrión. También fija el modelo comercial (qué vende Cabibee, quién cobra, dónde viven los precios).

Todo lo que dice "hoy" se verificó contra el commit `764ec29` (2026-09-28). Si algo ya cambió, gana el código y actualiza esta nota.

---

## 0. Cómo usar esta nota

1. Lee §1 (decisiones) y §2 (lo que está roto hoy) completas antes de tocar código.
2. Trabaja por fases en el orden de §10. **Un eje por deploy**: no mezcles migración de datos con cambios de API en el mismo push.
3. Al cerrar cada fase, anota en §12 (bitácora) qué quedó, qué endpoint cambió y cómo se probó.
4. Si algo de esta nota no se puede hacer como está escrito, no lo improvises en silencio: anótalo en §12 como pregunta para el founder.

---

## 1. Decisiones del founder (no se renegocian aquí)

| # | Decisión |
|---|----------|
| D1 | El agente de urbnbeeai **solo ofrece las propiedades del anfitrión conectado** a ese bot. Nunca listings de otros anfitriones. |
| D2 | **Cabibee manda.** Reserva manual o automática (`bookingApprovalMode`), cálculo del precio, moneda y cobro de la estancia son del motor de reservas de Cabibee. El bot solo **lee** y **reporta**; nunca calcula precios ni cobra. |
| D3 | **El huésped le paga la estancia directo al Stripe del anfitrión**, no a Cabibee ni a urbnbeeai. Hay que levantar un sistema de pagos por anfitrión igual que el de urbnbeeai (§5). |
| D4 | Lo que Cabibee vende (§3) y la tool de urbnbeeai se cobran en **una sola cuenta de Stripe compartida** entre Cabibee y urbnbeeai. |
| D5 | Cada sistema etiqueta en Stripe lo suyo (`metadata.app`) e **ignora lo que no es suyo** (§6). |
| D6 | **Los precios viven en urbnbeeai** (`pricing_catalog`). Cabibee los lee y su admin los edita por API (§7). |
| D7 | Cada producto tiene dos precios: **techo = precio público** (lo ve todo mundo) y **piso = solo lo ven los vendedores**. El vendedor de urbnbeeai arma paquetes con productos de urbnbeeai y de Cabibee, dentro de la banda. |
| D8 | **Admin de Cabibee** edita solo productos de Cabibee. **Admin de urbnbeeai** edita todos. El último que edita sobrescribe. |
| D9 | La tool "Cabibee" del bot (**$100/mes** por omisión) es **producto de urbnbeeai**: su precio lo edita solo el admin de urbnbeeai. |
| D10 | La conexión de cuentas nunca pide la contraseña de Cabibee dentro de urbnbeeai (§8). |

---

## 2. Lo que está roto hoy y hay que arreglar primero (P0)

Esto va **antes** que cualquier endpoint nuevo: el bot va a repetirle al huésped lo que diga Cabibee, así que si Cabibee se equivoca, el bot miente.

### 2.1 Los datos viven en archivos JSON

`lib/runtime-paths.ts` → `getDataDir()`: usuarios, listings, reservas, membresías, mensajes y vínculos con BeeAgent se guardan en `marketplace-store.json`, `bookings.json`, `guest-verification.json`, `host-inbox-messages.json` y `beeagent-host-links.json`. `lib/db.ts` solo hace ping, y el esquema `sql/001_schema.sql` se migra pero **nadie lo lee ni lo escribe**.

Riesgos:
- Si Railway no tiene un volumen montado con `URBNBEE_DATA_DIR`, **cada deploy borra todo**. Verifícalo hoy en Railway y anótalo en §12.
- Aun con volumen: dos requests que escriben el mismo archivo al mismo tiempo pueden perder una escritura (leer-modificar-escribir sin candado). Con el bot mandando tráfico, dos huéspedes pidiendo las mismas fechas pueden terminar con dos reservas.

**Qué hacer:** pasar todo a MySQL (el esquema ya existe; amplíalo con lo de esta nota). Script de migración idempotente desde los JSON actuales. Reservas con candado a nivel base de datos para no reservar dos veces las mismas noches (transacción + `SELECT ... FOR UPDATE` sobre el listing, o tabla de noches ocupadas con índice único por `(listing_id, fecha)`).

**C1 (2026-09-29):** `sql/002_c1_nights_and_json.sql` + `scripts/json-to-mysql.mjs` (arranque). Los stores siguen el JSON como caché y escriben MySQL. Crear/aceptar/rechazar reserva usa `urb_booking_nights` (índice único `listing_id + night_date`). Sin MySQL (dev local) el flujo JSON no cambia.

**C3 (2026-09-29):** `lib/booking-machine.ts` es el único módulo que cambia el estado de reserva. `PENDING` viejo se trata como `PENDING_HOST`. Pago y contrato van en campos aparte. Impago 48 h → `EXPIRED`. `AWAITING_DETAILS` termina en `CONFIRMED` al firmar el huésped. Eventos en `lifecycle` (webhooks §9.4 = C10, no aquí).

### 2.2 El pago de una reserva puede no registrarse

`app/api/webhooks/stripe/route.ts` (C3): cierra el pago de la estancia en `checkout.session.completed` y `checkout.session.async_payment_succeeded` vía `settleBookingCheckoutSession` → `markBookingPaid`. `verify-session` es el camino rápido e idempotente.

**Qué hacer:** el webhook tiene que cerrar el pago (`checkout.session.completed` con `mode === "payment"` y `payment_status === "paid"`, más `checkout.session.async_payment_succeeded`), buscando la reserva por `metadata.bookingId`. `verify-session` se queda como camino rápido, pero **idempotente**: el que llegue segundo no hace nada. Con §5, este webhook pasa a ser el webhook **por anfitrión**.

### 2.3 Estados de reserva incompletos

Flujo real hoy (`lib/booking-types.ts`, `lib/bookings-store.ts`, `app/api/host/bookings/[id]/route.ts`, `app/api/bookings/finish/route.ts`):

```
request → AWAITING_PAYMENT → (pago) → instant:  CONFIRMED
                                    → approval: PENDING → host acepta → AWAITING_DETAILS → /finish (solo guarda teléfono/notas)
                                                        → host rechaza → REJECTED
```

Problemas:
- En modo `approval`, **nada pasa la reserva a `CONFIRMED`**. `/finish` guarda datos pero no avanza el estado.
- `CANCELLED` y `COMPLETED` existen en el tipo pero **nadie los escribe**.
- En `approval` el huésped **paga antes** de que el anfitrión acepte. Si el anfitrión rechaza, no hay reembolso.
- No hay un estado de pago separado: solo `paidAt` y `stripeCheckoutSessionId`.

**Qué hacer:** máquina de estados explícita y documentada, con un solo módulo que haga las transiciones (nadie escribe el estado directo):

- Estado de reserva: `AWAITING_PAYMENT`, `PENDING_HOST`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `COMPLETED`, `EXPIRED` (sin pagar a tiempo). Si quieres conservar `AWAITING_DETAILS`, que sea un paso intermedio que **sí** termine en `CONFIRMED`.
- Estado de pago separado: `unpaid`, `paid`, `refunded`, `partially_refunded`, `failed`.
- Estado de contrato separado (§4.2): `not_required`, `pending`, `signed`.
- Rechazo o cancelación con pago hecho → reembolso en el Stripe del anfitrión (§5) y estado de pago `refunded`.
- Cada transición guarda quién la hizo, cuándo y desde dónde (`host`, `guest`, `system`, `beeagent`), y dispara el webhook de §9.4.
- Las noches quedan bloqueadas mientras la reserva esté en `AWAITING_PAYMENT` (con vencimiento), `PENDING_HOST` o `CONFIRMED`, y se liberan al pasar a `REJECTED`, `CANCELLED` o `EXPIRED`.

### 2.4 La API de integración no está acotada por anfitrión

**C8 (2026-09-29):** `requirePartnerLinkedHost` en host, listings, listing y booking-leads. Hace falta Bearer + `X-Beeagent-Customer-Id` + vínculo activo. Si falta cualquiera: `403` (`customer_id_required` / `not_linked`).

`POST /v1/hosts/provision`: email existente → `409 { code: "host_exists_confirm_required" }` (no enlaza). Email nuevo → crea host sin contraseña usable, `linked: false`, `pending_confirm: true`. El vínculo lo confirma el anfitrión por §8.

---

## 3. Qué vende Cabibee (catálogo)

**Actualizado 2026-09-29 (ya en producción en urbnbeeai):** los SKUs son **tus planes de `web/lib/membership-plans-types.ts`**, con el prefijo `cabibee_`. La API devuelve también `code` sin el prefijo, igual al tuyo.

| SKU (en `pricing_catalog` de urbnbeeai) | `code` | Quién lo compra | Cobro | Vendible por vendedores de urbnbeeai |
|---|---|---|---|---|
| `cabibee_pase_reserva` | `pase_reserva` | Huésped | pago único | No |
| `cabibee_meses_6` | `meses_6` | Huésped | suscripción, 6 meses | No |
| `cabibee_meses_12` | `meses_12` | Huésped | suscripción, 12 meses | No |
| `cabibee_anfitrion_6` | `anfitrion_6` | Anfitrión | suscripción, 6 meses | Sí |
| `cabibee_anfitrion_12` | `anfitrion_12` | Anfitrión | suscripción, 12 meses | Sí |
| `cabibee_booking_engine` | `booking_engine` | Anfitrión | suscripción mensual | Sí |

Todos nacen apagados y en 0, igual que tus semillas. El **motor de reservas** incluye cobro de la estancia **al Stripe del anfitrión** (§5), firma de contrato (§4.2), bloqueo de fechas y calendario, reserva manual o automática, y **la verificación del anfitrión**. Agrégalo a tus planes con el código `booking_engine`. El **screening** (costo del proveedor + margen) no es plan y se queda en Cabibee por ahora.

Y del lado de urbnbeeai, producto suyo (D9): la tool del bot "Cabibee" (id interno `host`, SKU `tool_host`). Hoy cuesta $9.90 y sube a $100/mes cuando el bot ya pueda ver disponibilidad y reservas (§9.2).

Los SKU de anfitrión se cobran con el catálogo local (`anfitrion_6` / `anfitrion_12` en `/admin/pricing`). C7 moverá esos montos a `pricing_catalog` de urbnbeeai. El huésped sigue con `pase_reserva` / `meses_6` / `meses_12`. Comisión por reserva: `PLATFORM_BOOKING_FEE_PERCENT` (Q1 abierta).

### 3.1 Derechos (entitlements) del anfitrión

**C6 (2026-09-29):** Cabibee guarda los derechos en `urb_host_sku_entitlements` + `host-entitlements.json` (`lib/host-entitlements.ts`).

- Filas por `(host_id, sku)`: `status` (`active`, `past_due`, `cancelled`), `source` (`cabibee_direct`, `urbnbeeai_seller`, `derived`), `stripe_subscription_id`, `current_period_end`.
- Membresía de anfitrión (Stripe o admin) escribe `cabibee_booking_engine` y deriva `cabibee_host_verification` (no se cobra aparte). `past_due` sigue abriendo el motor.
- Sin motor: el listing sigue publicado (chat / contacto); no muestra «Reserva con cuenta» ni acepta `POST /api/bookings/request`. Mientras el catálogo no tenga plan de anfitrión con precio, el candado queda abierto (el founder aún no cobra el motor).
- Checkout de anfitrión lleva `metadata.sku=cabibee_booking_engine`. `POST /v1/hosts/{hostId}/entitlements` = C9. `host.entitlements_changed` = C10. No los empiezo aquí.
- `urb_host_entitlements` (plan_tier de 001) no se usa.

---

## 4. Motor de reservas (lo que incluye `cabibee_booking_engine`)

### 4.1 Precio

Ya existe: `lib/booking-helpers.ts` → `sumStayMxn` (precio por noche con `nightlyPriceOverrides`, más `cleaningFee`) y el cargo de plataforma en `lib/platform-fees.ts` → `platformBookingFeeMxn`. Consérvalo como **la única** función que calcula el total, y exponla por la API de cotización (§9.2). El bot nunca suma nada por su cuenta.

La moneda la decide Cabibee (D2). Hoy está fija en `mxn`; si la cambias por listing, que la cotización y el webhook la devuelvan siempre explícita.

### 4.2 Firma de contrato

**C5 (2026-09-29):** El contrato se genera al **solicitar** la reserva (`ensureBookingContract` en `/api/bookings/request`). El huésped firma en `/contrato/{token}` **antes de pagar**: nombre + casilla + IP + `user-agent`. Se guardan `acceptedPlainText` y `acceptedSha256` (SHA-256 del texto que vio, sin la firma posterior). Checkout y pago demo responden `409 needsContract` si no hay `guestAcceptedAt`. El calendario redirige a `/contrato/{token}?pay=1`; «Pagar ahora» aparece tras firmar. PDF incluye la huella. `contractStatus` `pending` → `signed` cuando ambas partes firman (en `AWAITING_PAYMENT` no se cambia el estado de la reserva). Si el anfitrión acepta después y aún no ha firmado, `ensureBookingContract` lo firma. Plantillas por listing / PDF / firma dual ya existían.

### 4.3 Bloqueo de fechas

Ya existe `listing.blockedDates` (el anfitrión bloquea a mano) y el calendario público marca "Fechas reservadas". Falta que **las reservas activas bloqueen solas** las noches con el candado de §2.1, y que la disponibilidad que ve el bot (§9.2) salga de la misma fuente que el calendario. Importar/exportar iCal (Airbnb, Booking) queda para después.

---

## 5. Pagos de la estancia al Stripe del anfitrión (D3)

Hoy la estancia se cobra con Stripe Checkout en la cuenta de la plataforma (`STRIPE_SECRET_KEY`). Eso cambia: **la estancia se cobra en la cuenta de Stripe del propio anfitrión.**

**C4 (2026-09-29):** `/host/settings/pagos` guarda `sk_`/`rk_` + `whsec_` cifrados (`HOST_PAYMENT_CREDS_KEY`). Webhook `POST /api/webhooks/stripe/host/[hostId]`. Si el anfitrión está conectado, Checkout usa su llave y **no** suma el 1% (Q1 abierta). Si no, sigue la cuenta de Cabibee para no tumbar reservas mientras el founder configura. Reembolso usa la misma cuenta que cobró.

Copia el patrón que ya funciona en urbnbeeai (Payment Hub):

- El anfitrión conecta **su** Stripe en `/host/settings/pagos`: pega su secret key (`sk_live_…` o una restricted key con permisos de Checkout, Refunds y lectura de PaymentIntents) y el signing secret de su webhook.
- Ambos se guardan **cifrados** (AES-256-GCM, llave en variable de entorno propia de Cabibee, p. ej. `HOST_PAYMENT_CREDS_KEY`). Nunca se devuelven al navegador; la UI solo muestra "conectado" y los últimos 4 caracteres.
- Webhook **por anfitrión**: `POST /api/webhooks/stripe/host/[hostId]`. El anfitrión da de alta esa URL en su Dashboard de Stripe. Cabibee verifica la firma con el signing secret de **ese** anfitrión. Referencia en urbnbeeai: `src/app/api/webhooks/stripe/[customerId]/route.ts`.
- Al conectar, valida la llave con una llamada barata (`stripe.accounts.retrieve()` o `balance.retrieve()`) y guarda `last_verified_at` / `last_error`.
- Reembolsos (§2.3) salen de la cuenta del anfitrión con su llave.
- Registro de cada intento de cobro en una tabla de transacciones (monto bruto, comisión del procesador si se puede leer del `balance_transaction`, neto, estado, `provider_ref`). No guardes tarjetas.
- La comisión de plataforma por reserva que hoy se suma como línea en el Checkout **ya no puede cobrarse así** (el dinero ya no pasa por la cuenta de la plataforma). Ver pregunta abierta Q1 en §11.
- Mientras un anfitrión no tenga Stripe conectado, el motor no acepta reservas pagadas en línea para sus listings, y la UI se lo dice claro.

---

## 6. Stripe compartido: etiquetar y filtrar (D4, D5)

Cabibee y urbnbeeai usan **la misma cuenta de Stripe** para suscripciones y membresías. Cada webhook recibe los eventos del otro. Regla:

- **Todo** lo que Cabibee crea en la cuenta compartida lleva `metadata.app = "cabibee"`: Checkout Sessions, `subscription_data.metadata`, `payment_intent_data.metadata`, Customers, sesiones de Stripe Identity. Las facturas heredan la metadata de la suscripción.
- El webhook de plataforma de Cabibee (`app/api/webhooks/stripe/route.ts`) **ignora** (responde `200 { ignored: "not_cabibee" }`) cualquier evento cuyo objeto no tenga `metadata.app === "cabibee"`. Compatibilidad: acepta también los objetos viejos sin `app` pero con `metadata.userId`, `bookingId` o `kind` (membresías, reservas y screening creados antes de este cambio).
- urbnbeeai hace lo mismo con `metadata.app = "urbnbee"`. Hoy urbnbeeai escucha `invoice.*` y guardaría como huérfanas las facturas de membresías de Cabibee; se arregla de su lado.
- Las cuentas de Stripe **de los anfitriones** (§5) no son la compartida: ahí no aplica este filtro, porque cada anfitrión tiene su propio webhook.

---

## 7. Precios: viven en urbnbeeai, Cabibee los lee y edita por API (D6–D8)

La fuente única de precios es `pricing_catalog` en urbnbeeai. Cada fila tendrá `provider` (`urbnbee` o `cabibee`), precio público (**techo**) y **piso**. Cabibee **no** guarda su propia copia de precios; solo un caché.

Del lado de urbnbeeai (lo construye el agente de urbnbeeai; aquí va el contrato para que Cabibee lo consuma):

| Método | Ruta en urbnbeeai | Para qué | Auth |
|---|---|---|---|
**Ya está en producción (2026-09-29).** Responde 503 `cabibee_integration_not_configured` hasta que el founder ponga `CABIBEE_TO_URBNBEEAI_API_SECRET` con el mismo valor en los dos Railway.

| Método | Ruta en urbnbeeai | Para qué | Auth |
|---|---|---|---|
| GET | `/api/integrations/cabibee/v1/catalog` | `{ skus: [...] }`, cada uno con `sku`, `code`, `audience` (`guest`/`host`), `label`, `description`, `public_price` (USD), `public_price_mxn`, `billing` (`{kind:"one_time"}` o `{kind:"subscription", interval_count}`) y `active`. **Nunca incluye el piso.** 0 en una moneda = no se ofrece en esa región. | Bearer `CABIBEE_TO_URBNBEEAI_API_SECRET` |
| GET | `/api/integrations/cabibee/v1/admin/catalog` | Igual, más `floor_price` (USD), `seller_sellable`, `price_is_provisional`, `updated_at`, `updated_from` (`urbnbee_admin`/`cabibee_admin`/`migration`) y `updated_by`. | Mismo Bearer + header `X-Cabibee-Admin-Email` |
| PATCH | `/api/integrations/cabibee/v1/admin/catalog/{sku o code}` | Cambiar `public_price`, `public_price_mxn`, `floor_price` (USD o `null`), `active` (booleano), `label` o `description`. Cualquier otro campo → 400. Un SKU que no es de Cabibee no se puede tocar (404/403). Valida `floor_price <= public_price`. Para encender hace falta precio en USD o en MXN. Responde `{ ok, sku }` con la fila ya guardada. | Mismo Bearer + `X-Cabibee-Admin-Email` |

La forma de cobro (`billing`) no se edita, igual que en tu `MEMBERSHIP_PLAN_BILLING`. El piso y el techo son solo en USD, porque urbnbeeai vende en USD.

Lo que hace Cabibee:
- **Tu `/admin/pricing`, el que ya hiciste** (`web/app/api/admin/pricing/[code]/route.ts`): deja de escribir `membership-plans.json` y llama al PATCH desde el **servidor**, nunca desde el navegador (el secreto no sale del servidor). La primera vez que conectes, sube con el PATCH los precios que ya tengas en el JSON de producción, para que urbnbeeai arranque con tus valores reales. Después el JSON queda como caché: el Producto de Stripe (`stripeProductId`) sí se queda de tu lado.
- Donde Cabibee muestra o cobra un precio (página de membresía, contratar motor de reservas), lo toma de `GET /catalog` con caché corto (5 min) y respaldo al último valor bueno si urbnbeeai no responde. Deja de usar los Price IDs fijos en variables de entorno: crea el Checkout con `price_data` y el monto del catálogo.
- El piso **nunca** aparece en páginas públicas, en el HTML ni en respuestas de API públicas de Cabibee.
- "El último que edita sobrescribe": como hay una sola copia, sale solo. Cada cambio queda auditado en urbnbeeai con quién, desde qué sistema y cuándo.
- Un cambio de precio **no** cambia lo que ya pagan los anfitriones con suscripción activa ni lo pactado por un vendedor; aplica a compras nuevas.

---

## 8. Conexión de cuentas Cabibee ↔ urbnbeeai (D10)

Lo que ya existe y se reutiliza: códigos de vinculación de 10 minutos (`lib/beeagent-host-link-store.ts`, `POST /api/host/integrations/beeagent/link-code`, pantalla `/host/settings/integrations`) y `POST /v1/hosts/link`.

**C8 (2026-09-29):** `/host/settings/integrations/connect?return_url=&state=` (origen de `return_url` en `URBNBEEAI_CONNECT_RETURN_ORIGINS`). «Permitir» genera el código de 10 min y redirige a `return_url?code=&state=`. Desde Integraciones: «Activar agente IA» → `URBNBEEAI_CONNECT_START_URL`. Desconectar en Cabibee y `DELETE /v1/hosts/:hostId/link`. Sin webhook `host.unlinked` (C10).

### 8.1 Camino principal: botón "Conectar" con redirección (sin copiar y pegar)

Desde urbnbeeai:
1. El tenant da clic en **Conectar Cabibee** en su agente.
2. urbnbeeai abre `https://cabibee.com/host/settings/integrations/connect?return_url=<url urbnbeeai>&state=<aleatorio>`.
3. Si no hay sesión, Cabibee pide login (con `next=` de regreso a esta misma pantalla). La contraseña se teclea **solo en Cabibee**.
4. Cabibee muestra: "urbnbeeai quiere ver tus listings, disponibilidad y reservas para que tu agente IA atienda a tus huéspedes. ¿Permitir?".
5. Si acepta: Cabibee genera un código de vinculación y redirige a `return_url?code=<código>&state=<el mismo state>`.
6. urbnbeeai verifica el `state` y llama `POST /v1/hosts/link` (ya existe) con el código.

Desde Cabibee:
1. El anfitrión da clic en **Activar agente IA con urbnbeeai** en `/host/settings/integrations`.
2. Cabibee lo manda a `https://www.urbnbeeai.com/integrations/cabibee/start` (urbnbeeai pide login o registro y que elija el agente).
3. urbnbeeai lo regresa al paso 2 del flujo de arriba, que ya tiene sesión en Cabibee y solo pide confirmar.

Reglas:
- `return_url` solo se acepta si su origen está en una lista permitida (variable `URBNBEEAI_CONNECT_RETURN_ORIGINS`, por omisión `https://www.urbnbeeai.com`). Si no, `400`. Sin esto, cualquiera puede robarse códigos.
- El código es de un solo uso y dura 10 minutos (como hoy).
- Solo usuarios con rol `host` (o `admin`) pueden conectar.

### 8.2 Respaldo: código manual

Se queda como está: el anfitrión genera el código en Integraciones y lo pega en urbnbeeai.

### 8.3 Confirmación por email (después)

Cabibee hoy **no envía correos** (no hay proveedor configurado). Cuando lo tenga (lo va a necesitar igual para avisos de reserva), se agrega "te mandamos un correo a la cuenta de Cabibee para confirmar". No bloquea nada de lo anterior.

### 8.4 Desconectar

Desde cualquiera de los dos lados:
- Cabibee: botón "Desconectar" en Integraciones → borra el vínculo y manda `host.unlinked` (§9.4).
- urbnbeeai: llama `DELETE /v1/hosts/{hostId}/link` (nuevo) → Cabibee borra el vínculo.
Desde ese momento §2.4 devuelve `403` a todo.

---

## 9. API de socio v2 (lo que el bot necesita)

**C9 (2026-09-29):** `api_version: "v2"` en `/meta`. Host trae `entitlements` y `payments_connected`. Listings: `bookable` (publicado + motor + Stripe del anfitrión), moneda, noches mín., huéspedes, limpieza, reglas, cancelación. Availability / quote / booking-link usan `sumStayMxn` + `platformBookingFeeMxn` y el mismo candado de noches que el calendario. `booking-link` abre `/listings/{slug}?checkIn=&checkOut=&ref=`. Leads guardan `conversation_key`. Incoming `agent.status_changed` y `entitlements.changed` aplican estado/SKU. POSTs respetan `Idempotency-Key`. Webhooks salientes = C10. Chat al agente = C11.

Base: `https://cabibee.com/api/integrations/beeagent/v1`. Todas con Bearer `URBNBEE_PARTNER_API_SECRET`. Las marcadas 🔒 además con `X-Beeagent-Customer-Id` y vínculo activo (§2.4). Respuestas en JSON, fechas `YYYY-MM-DD` en la zona del listing, montos como número con `currency` explícita.

### 9.1 Ya existen (ajustar)

| Ruta | Cambio |
|---|---|
| `GET /meta` | Listar también las rutas nuevas y una `api_version`. |
| `GET /host/:hostId` | 🔒. Agregar `entitlements` (§3.1) y `payments_connected` (bool, §5). |
| `GET /listings?hostId=` | 🔒. Agregar `booking_approval_mode`, `bookable` (tiene motor + Stripe conectado + publicado), `currency`, `min_nights`, `max_guests`, `cleaning_fee`. |
| `GET /listings/:idOrSlug` | 🔒 cuando se pide con `hostId`; devolver `404` si el listing no es de ese host. Agregar reglas, política de cancelación y los campos de arriba. |
| `POST /hosts/provision` | Quitar el enlace automático por email (§2.4). |
| `POST /hosts/link` | Sin cambio. |
| `POST /booking-leads` | 🔒. Aceptar `conversation_key` y guardarlo en el lead. |
| `POST /webhooks/events` | Hoy solo registra en log. Usarlo para recibir de urbnbeeai `agent.status_changed` y `entitlements.changed` (§9.3), con HMAC como hoy. |

### 9.2 Nuevas

| Método | Ruta | Qué devuelve |
|---|---|---|
| GET 🔒 | `/listings/:id/availability?from=&to=` (máx. 180 días) | `{ listing_id, currency, nights: [{ date, available, reason: "booked"\|"blocked"\|"past"\|null, price }] }`. Misma fuente que el calendario público. |
| POST 🔒 | `/listings/:id/quote` `{ check_in, check_out, guests }` | `{ ok, currency, nights, breakdown: [{ label, amount }], total, platform_fee, booking_approval_mode, errors: ["min_nights"\|"max_guests"\|"unavailable"\|"not_bookable"] }`. Sale de `sumStayMxn` + `platformBookingFeeMxn` (las mismas que usa `POST /api/bookings/request`); no reserva nada. |
| POST 🔒 | `/listings/:id/booking-link` `{ check_in, check_out, guests, conversation_key }` | `{ booking_url, register_url, ref, expires_at }`. `booking_url` abre el listing con fechas y huéspedes ya llenos. `register_url` = `/register?next=<booking_url>` para quien no tiene cuenta. `ref` liga la futura reserva con la conversación del bot. |
| GET 🔒 | `/hosts/:hostId/bookings?status=&from=&to=` | Reservas del host: `booking_id`, `ref`, `listing_id`, fechas, huéspedes, `status`, `payment_status`, `contract_status`, `total`, `currency`, nombre del huésped (**solo el primer nombre**), `created_at`. Sin teléfono ni email. |
| GET 🔒 | `/bookings/:id` (o `?ref=`) | Detalle de una reserva del host con los tres estados de §2.3 y `guest_requirements` (abajo). |
| GET 🔒 | `/bookings/:id/guest-requirements` | `{ has_account, membership_active, identity_verified, contract_signed, next_step: "register"\|"membership"\|"identity"\|"contract"\|"pay"\|null, next_step_url }`. Solo para reservas o ligas de ese host; nunca por email o teléfono suelto. |
| POST 🔒 | `/hosts/:hostId/entitlements` | Lo llama urbnbeeai cuando un vendedor le vende un SKU de Cabibee: `{ sku, status, stripe_subscription_id, current_period_end }`. Idempotente por `(host_id, sku, stripe_subscription_id)`. |
| POST 🔒 | `/hosts/:hostId/agent-status` | Lo llama urbnbeeai al activar, suspender o desactivar la tool: `{ active, customer_agent_id }`. Cabibee lo muestra en Integraciones y lo usa para §9.5. |
| DELETE 🔒 | `/hosts/:hostId/link` | Desvincular (§8.4). |

Todas las POST aceptan header `Idempotency-Key`; un reintento con la misma llave devuelve la misma respuesta.

### 9.3 Qué hace el bot con esto (para que entiendas el uso)

- "¿Tienes del 15 al 18?" → `availability` y `quote`. Nunca dice "sí hay" sin eso.
- "Quiero reservar" → `booking-link` (y `register_url` si no tiene cuenta). El huésped reserva y paga él mismo en Cabibee.
- "¿Ya quedó mi reserva? ¿Ya pasó mi pago?" → `bookings/:id` cada vez que pregunte.
- "¿Qué me falta?" → `guest-requirements` y manda `next_step_url`.
- El anfitrión pregunta "¿qué reservas tengo esta semana?" → `hosts/:hostId/bookings`.

### 9.4 Webhooks salientes Cabibee → urbnbeeai

**C10 (2026-09-29):** Cola en `urb_outbound_webhooks` + JSON. Firma `X-Cabibee-Signature: sha256=<hex>`. Reintentos con espera hasta 24 h. 200/duplicate/ignored = entregado; 400/401 = no reintenta; 500/503/red = reintenta. Solo hosts con vínculo, salvo `host.unlinked` (se encola con el customer id antes de borrar). `host.entitlements_changed` solo si el cambio nació en Cabibee (`cabibee_direct` / `derived`), no si vino de urbnbeeai. Worker al arrancar + cada 60 s + `GET /api/cron/partner-webhooks`. URL: `URBNBEEAI_WEBHOOK_URL` o `https://www.urbnbeeai.com/api/integrations/cabibee/webhooks`. Sin C11.

`POST https://www.urbnbeeai.com/api/integrations/cabibee/webhooks` con header `X-Cabibee-Signature: sha256=<hex>` = HMAC-SHA256 del cuerpo crudo con `URBNBEE_PARTNER_WEBHOOK_SECRET` (el mismo mecanismo que ya usas de entrada, en sentido contrario).

```json
{
  "event_id": "evt_…",
  "event": "booking.paid",
  "occurred_at": "2026-10-01T18:22:00Z",
  "host_id": "…",
  "beeagent_customer_id": 123,
  "booking_id": "…",
  "ref": "…",
  "conversation_key": "…",
  "data": { "status": "PENDING_HOST", "payment_status": "paid", "contract_status": "signed", "total": 11645, "currency": "MXN", "check_in": "2026-10-15", "check_out": "2026-10-18", "listing_id": "…" }
}
```

Eventos: `booking.requested`, `booking.contract_signed`, `booking.paid`, `booking.confirmed`, `booking.rejected`, `booking.cancelled`, `booking.refunded`, `booking.expired`, `host.entitlements_changed`, `host.unlinked`.

Reglas: `event_id` único (urbnbeeai deduplica por él); reintentos con espera creciente hasta 24 h; cola persistente en MySQL (no en memoria, porque un redeploy la perdería); solo se envían para hosts con vínculo activo.

**El receptor ya está en producción (2026-09-29). Puedes arrancar C10.** Lo que contesta:

| Respuesta | Qué significa | Qué hace Cabibee |
|---|---|---|
| `200 { ok: true }` | Procesado. | Marca entregado. |
| `200 { ok: true, duplicate: true }` | Ese `event_id` ya llegó. | Marca entregado. |
| `200 { ok: true, ignored: "<motivo>" }` | Válido pero no aplica. Motivos: `host_not_linked`, `unknown_event`, `missing_customer_or_host`, `missing_booking_id`, `missing_entitlements`. | Marca entregado; **no** reintentes. Si ves `host_not_linked` seguido, revisa el vínculo de ese host. |
| `400` | Falta `event_id` o `event`, o el JSON no es válido. | No reintentes: corrige el emisor. |
| `401 invalid_signature` | La firma no cuadra. | Revisa el secreto; no reintentes en bucle. |
| `503` | urbnbeeai no tiene el secreto configurado. | Reintenta con espera. |
| `500` | Falló al procesar. | Reintenta con espera. |

Detalles que importan de tu lado:
- **`occurred_at` es obligatorio en la práctica.** urbnbeeai ordena por esa hora: un evento más viejo que el último que recibió de esa reserva no cambia nada ni avisa. Usa la hora en que ocurrió el cambio, no la del envío.
- **Firma:** HMAC-SHA256 del cuerpo crudo exacto que mandas, en hex, con el prefijo `sha256=`. El secreto es `URBNBEE_PARTNER_WEBHOOK_SECRET`, o `URBNBEE_PARTNER_API_SECRET` si no hay otro, igual que tu `getPartnerWebhookSecret()`.
- **`data.status = "PENDING_HOST"`** en `booking.requested` hace que el aviso le pida al anfitrión aprobar en Cabibee.
- **`host.entitlements_changed`** manda `data.entitlements` como arreglo, por ejemplo `[{ "sku": "cabibee_anfitrion_6", "status": "active", "current_period_end": "…" }]`, usando los SKUs de §3.
- **`conversation_key`:** urbnbeeai no usa el que mandas. Lo busca por `ref` en su propia tabla de ligas. Puedes seguir mandándolo; no hace daño.
- Máximo 64 KB por cuerpo.

### 9.5 Chat del listing → agente del anfitrión (fase posterior)

Hoy `components/listing/ai-chat-widget.tsx` → `POST /api/listings/[id]/chat` usa OpenAI propio. Cuando el host tenga `agent-status.active = true`, el widget debe mandar los mensajes al agente del anfitrión en urbnbeeai. El endpoint público de urbnbeeai todavía no existe; se define en una nota posterior. **No lo empieces todavía.**

---

## 10. Orden de trabajo sugerido (fases)

| Fase | Qué | Depende de |
|---|---|---|
| C0 | Revisar volumen en Railway (`URBNBEE_DATA_DIR`) y anotarlo en §12. Respaldo de todos los JSON. | — |
| C1 | Migrar datos de JSON a MySQL con candado de noches (§2.1). | C0 |
| C2 | Etiqueta `metadata.app` y filtro en el webhook (§6). | — |
| C3 | Máquina de estados de reserva y webhook de pago idempotente (§2.2, §2.3). | C1 |
| C4 | Pagos de la estancia al Stripe del anfitrión (§5). | C3 |
| C5 | Firma de contrato (§4.2). | C3 |
| C6 | Derechos del anfitrión y productos (`host_entitlements`, verificación del anfitrión, candado del motor) (§3). | C1 |
| C7 | Precios desde urbnbeeai y pantalla `/admin/precios` (§7). | C6 + catálogo del lado urbnbeeai |
| C8 | Seguridad de la API (vínculo obligatorio, `provision` sin auto-enlace) y conexión por redirección (§2.4, §8). | C1 |
| C9 | API v2 (§9.1, §9.2). | C3, C8 |
| C10 | Webhooks salientes (§9.4). | C9 + receptor del lado urbnbeeai |
| C11 | Chat del listing al agente (§9.5). | Nota posterior |

C2 se puede hacer en cualquier momento y es chica: conviene sacarla pronto.

---

## 11. Preguntas abiertas para el founder (no las decidas tú)

- **Q1.** La comisión de Cabibee por reserva (hoy 1% en `PLATFORM_BOOKING_FEE_PERCENT`, sumada al Checkout). Si la estancia se cobra en el Stripe del anfitrión, ¿se elimina, se incluye en el precio del motor de reservas, o se acumula y se le cobra al anfitrión cada mes (como hace urbnbeeai hoy con su comisión)?
- **Q2.** Los precios del catálogo de urbnbeeai están en USD. La membresía del huésped hoy se cobra en MXN (México) y USD (EE. UU.). ¿Precio por moneda en el catálogo o un solo precio en USD?
- **Q3.** Si un anfitrión deja de pagar el motor de reservas, ¿qué pasa con las reservas ya confirmadas y las fechas futuras?

---

## 12. Bitácora (la llena el agente de Cabibee)

| Fecha | Fase | Qué quedó / qué cambió | Cómo se probó |
|---|---|---|---|
| 2026-09-29 | C10 | Cola saliente HMAC a urbnbeeai. Eventos de reserva, unlink y entitlements Cabibee. Sin C11. | `tsc --noEmit`. Casos de firma/clasificación 200/400/401/503. |
| 2026-09-29 | C1–C9 | Código de C1–C9 a `main`/Railway (antes solo local). Arranque aplica `002`–`004` + `json-to-mysql`. Sin C10/C11. | `tsc --noEmit`. Push `main` → autodeploy Urbnbee Rentals. |
| 2026-09-29 | urbnbeeai U2 | urbnbeeai etiqueta `metadata.app="urbnbee"` e ignora lo tuyo en su webhook (también tus objetos viejos con `metadata.userId`). | Deploy SUCCESS |
| 2026-09-29 | urbnbeeai U1 | La tool se llama Cabibee y apunta a `https://cabibee.com`. Manda `X-Beeagent-Customer-Id` en **cada** llamada a `/v1`. Ya no acepta host ID a mano. Muestra el 409 `host_exists_confirm_required` como "usa un código". | Deploy SUCCESS |
| 2026-09-29 | urbnbeeai U5+U6 | Catálogo con tus 5 planes + motor, en MXN y USD, y la API de §7 en producción. | 31 casos contra la base de prod; deploy SUCCESS |
| 2026-09-29 | urbnbeeai U8 | Receptor de webhooks de §9.4 en producción. **C10 desbloqueado.** | 27 casos contra la base de prod con un agente de prueba |
| 2026-09-29 | urbnbeeai U7 | El bot ya usa tu v2:<br>- `POST /listings/:id/quote` y `GET /availability` para cotizar y sugerir otras fechas.<br>- `POST /booking-link` con `Idempotency-Key` y `conversation_key`. La liga sale en un mensaje aparte y el `ref` se guarda del lado de urbnbeeai.<br>- `GET /bookings?ref=` sólo para refs emitidos en la misma conversación.<br><br>No usa `GET /hosts/:id/bookings` en el chat, porque el bot habla con huéspedes. `guests` se manda tal cual lo dice el huésped. | 16 casos con host stub contra la base de prod. Contra cabibee.com: listing inexistente → 404 manejado. **Aún no hay un anfitrión real vinculado**, así que falta la prueba de punta a punta. |
| 2026-09-29 | C0 | Respaldo local de 7 JSON en `_backups/json-c0-2026-09-29/` (gitignore `_backups/`). Faltan en local: stay-reviews, membership-plans, beeagent-host-links, guest-verification, blog-bot-config. | `git pull` → `9c77bc7`. Copia de `web/data/*.json`. |
| 2026-09-29 | C0 | Founder dijo que ya están las vars. **Sigo sin ver el proyecto Urbnbee Rentals:** `RAILWAY_TOKEN` de esta máquina es de `urbnbee-prod`; la sesión OAuth local está vencida (`invalid_grant`) y `railway login` no corre en modo no-interactivo. No pude leer `URBNBEE_DATA_DIR` / `URBNBEE_UPLOADS_DIR` ni el mount path. C0 sigue abierto; no C1. | `railway status` → `urbnbee-prod`. `railway whoami` sin token → login vencido. |
| 2026-09-29 | C0 | Founder mostró Railway **Urbnbee Rentals** (workspace `superb-learning`, env production). Canvas: **MySQL** (`mysql-volume`) + **Urbnbee Rentals** (`www.cabibee.com`, volume `superb-learning-volume`). | Captura del canvas Railway. |
| 2026-09-29 | C9 | API v2: meta, host entitlements/pagos, listings bookable, availability, quote, booking-link, bookings, guest-requirements, entitlements POST, agent-status, leads con conversation_key, webhook inbound. Idempotency-Key. Sin C10/C11. **Aviso al founder: ya puede avisar al agente de urbnbeeai.** | `tsc --noEmit`. Quote/availability 401/503 sin secreto; meta lista rutas v2. |
| 2026-09-29 | C8 | Rutas privadas: Bearer + `X-Beeagent-Customer-Id` + vínculo. `provision` ya no enlaza por email (409 `host_exists_confirm_required`; host nuevo sin link). Connect por redirect + código. Disconnect local y DELETE link. Sin C10. No aviso a urbnbeeai (falta C9). | `tsc --noEmit`. Host/listings sin header → 403. return_url fuera de lista → 400. |
| 2026-09-29 | C6 | `urb_host_sku_entitlements` + store. Membresía anfitrión = `cabibee_booking_engine` (+ verificación derivada). Sin motor: directorio, no request. Candado abierto si el catálogo host no tiene precio. No C9/C10. No aviso a urbnbeeai. | `tsc --noEmit`. Request 403 `hostNotBookable` si hay entitlement cancelled y plan host con precio. |
| 2026-09-29 | C5 | Contrato al request. Huésped firma antes de pagar (texto + SHA-256 + IP + UA). Checkout 409 sin firma. Calendario → `/contrato/{token}?pay=1`. Firma en `AWAITING_PAYMENT` no confirma la reserva. No aviso a urbnbeeai. | `tsc --noEmit`. Flujo request → contrato → firma → checkout. |
| 2026-09-29 | C0 | **C0 cerrado.** Login `tonny_voss@outlook.com`, link a `superb-learning` / `Urbnbee Rentals`. Volume `superb-learning-volume` mount **`/data`**. Vars: `URBNBEE_DATA_DIR=/data/json`, `URBNBEE_UPLOADS_DIR=/data/uploads`, `DATABASE_URL` set. Respaldo prod byte-exact en `_backups/json-c0-prod-2026-09-29/` (4 JSON; los del volume datan de mayo). No hay screening/reviews/membership/verification/beeagent en el volume. No arranco C1 en este mismo eje. | `railway whoami` / `link` / `variables` (solo keys de persistencia). `railway ssh -- ls /data/json`. Copia via `base64` (tamaños 3888/540/2943/9223). |
| 2026-09-29 | C4 | `/host/settings/pagos` + API + webhook por anfitrión. Creds AES-256-GCM (`HOST_PAYMENT_CREDS_KEY`, tú la pones después). Sin conectar, Checkout sigue en Cabibee. Conectar → cobro en su Stripe, sin línea de comisión (Q1). Reembolso en la cuenta que cobró. Log `urb_booking_transactions`. No aviso a urbnbeeai. | `tsc --noEmit`. `db-migrate` prod: 003_c4_host_payments.sql. |
| 2026-09-29 | C3 | Máquina en `lib/booking-machine.ts`: pago → instant `CONFIRMED` / approval `PENDING_HOST`; host acepta → `AWAITING_DETAILS`; huésped firma → `CONFIRMED`; 48 h sin pagar → `EXPIRED`; estancia terminada → `COMPLETED`. Campos `paymentStatus`, `contractStatus`, `lifecycle`. Webhook también `checkout.session.async_payment_succeeded`. `verify-session` idempotente. `PENDING` viejo = `PENDING_HOST`. No aviso a urbnbeeai. | `tsc --noEmit`. |
| 2026-09-29 | C2 | `metadata.app=cabibee` en Checkout, `subscription_data`, `payment_intent_data`, Identity, Products y reembolsos. Webhook responde `200 { ignored: "not_cabibee" }` si el objeto es de otro `app`. Legacy sin `app`: acepta `userId` / `bookingId` / `kind`. Helper `lib/stripe-app-meta.ts`. No aviso al agente de urbnbeeai (eso es C8/C9). | `tsc --noEmit`. Casos del filtro: cabibee sí, urbnbee no, legacy userId/bookingId/kind sí, vacío no. |
| 2026-09-29 | C1 | MySQL es destino: `002_c1_nights_and_json.sql` (`urb_booking_nights` único por listing+noche, inbox, beeagent, `urb_json_blobs`). `json-to-mysql.mjs` idempotente (stubs si una reserva apunta a un listing que no está en el store). Stores JSON dual-write. `insertBookingLocked` + aceptar/rechazar usan transacción + `FOR UPDATE`. Arranque: migrate + sync. Esquema y datos de prod ya corridos a mano contra MySQL. | `tsc --noEmit` OK. `db-migrate` prod: 001+002+`address_line`. `json-to-mysql` ×2 desde backup C0: users 3, listings 4, bookings 1, nights 4, inbox 6, blobs 1, nightConflicts 0. |
