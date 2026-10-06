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
| D6–D8 ⚠️ | **Cambio del founder (2026-10-03), reemplaza D6–D8 para los productos de Cabibee:** urbnbeeai **sólo** modifica el precio de su propia conexión con Cabibee (la tool, `tool_host`). **No** modifica precios de productos de Cabibee (membresías, motor de reservas, Tienda): esos los decide sólo Cabibee. Ver §12, 2026-10-03. |
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
- Membresía de anfitrión (Stripe o admin) escribe `cabibee_booking_engine` y deriva `cabibee_host_verification` (no se cobra aparte). El motor y el listón «Miembro verificado» piden estado `active` y período sin vencer. `past_due`, cancelada o período vencido los apagan.
- Sin motor: el anuncio sigue publicado (chat / contacto) y las reservas ya hechas siguen visibles. No entran solicitudes nuevas (`POST /api/bookings/request` responde `hostNotBookable`) y el anfitrión no puede aceptar, firmar ni cobrar depósito. Rechazar (para devolver el pago) y soltar un depósito sí se puede.
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

El chat **huésped ↔ anfitrión** (los mensajes del anuncio, `Mensajes` en la app) ya quedó conectado del lado de Cabibee: ver §9.6.

### 9.6 Chat de Cabibee ↔ central de chat de urbnbeeai (C11, lado Cabibee listo 2026-10-03)

**Qué pidió el founder:** que el chat de Cabibee llegue a la central de chat de urbnbeeai, que el agente lo conteste, y que en Cabibee exista el mismo botón de «desactivar IA» por conversación que hay en urbnbeeai.

**Clave de conversación:** `conversation_key = "cabibee:{listingId}:{guestSessionId}"` (va en el sobre del webhook y en todas las respuestas).

**Webhooks salientes nuevos** (mismo sobre, firma y reintentos que §9.4; `booking_id`/`ref` van `null`):

| Evento | Cuándo | `data` |
|---|---|---|
| `message.created` | Cada mensaje del chat de un anuncio cuyo anfitrión está vinculado (huésped o anfitrión; texto, foto o nota de voz). No se reenvían los que manda urbnbeeai. | `listing_id`, `guest_session_id`, `message {id, sender: guest\|host, via: null\|"ai", body, guest_name, created_at, attachment: null\|{kind: image\|audio, mime, bytes, duration_sec, path}}`, `available`, `ai_replies_enabled`, `updated_at` |
| `conversation.ai_changed` | El anfitrión prendió o apagó la IA desde Cabibee. | `listing_id`, `guest_session_id`, `changed_by: "host"`, `available`, `ai_replies_enabled`, `updated_at` |

`attachment.path` es relativo a la base de Cabibee (`https://cabibee.com`); se descarga con el mismo Bearer + `X-Beeagent-Customer-Id`.

**API nueva 🔒** (Bearer + `X-Beeagent-Customer-Id` + vínculo; base `/api/integrations/beeagent/v1`):

| Método | Ruta | Para qué |
|---|---|---|
| GET / PUT | `/hosts/:hostId/chat-channel` | `PUT {enabled:true}` cuando tu central ya recibe y contesta el chat de Cabibee de ese anfitrión. **Hasta entonces la IA empieza apagada** en cada conversación (el anfitrión la puede prender a mano). Con el canal encendido, las conversaciones nuevas empiezan con la IA prendida, igual que en urbnbeeai. |
| GET | `/hosts/:hostId/conversations?since=` | Lista de conversaciones con el último mensaje y `ai_replies_enabled`. Sirve para la carga inicial. |
| GET | `/hosts/:hostId/conversations/:listingId/:guestSessionId` | Historial completo. |
| POST | `/hosts/:hostId/conversations/:listingId/:guestSessionId/messages` | El agente contesta a nombre del anfitrión: `{body, client_message_id?}`. El mensaje queda con `via:"ai"`, al huésped le llega aviso y el anfitrión lo ve marcado «Respondido por IA». Con la IA apagada → **409 `ai_disabled`** (o `agent_unavailable` si el agente no está activo): no contestes. `client_message_id` repetido → 200 `duplicate:true`, no duplica. |
| GET / POST | `/hosts/:hostId/conversations/:listingId/:guestSessionId/ai` | Leer o cambiar el modo IA: `POST {ai_replies_enabled, if_match_updated_at?}`. Si `if_match_updated_at` no coincide → 409 `conflict` con el estado actual. |
| GET | `/hosts/:hostId/conversations/:listingId/:guestSessionId/attachments/:file` | Foto o nota de voz (para verla o transcribirla). |

Alternativa al POST `/ai`: el webhook firmado que ya mandas a `/v1/webhooks/events` acepta `event: "conversation.ai_changed"` con `conversation_key` y `data.ai_replies_enabled`.

**El modo IA es por conversación y hay una sola verdad en Cabibee.** El anfitrión lo cambia en cualquiera de los dos lados: si lo cambia en urbnbeeai, llama `POST .../ai`; si lo cambia en Cabibee, te llega `conversation.ai_changed`. Sólo existe mientras `agent-status.active = true`; con el agente apagado `available = false` y la IA no contesta.

**Lo que ve el anfitrión en Cabibee** (app → Mensajes → conversación): botón «IA activa / IA apagada» arriba. Con la IA activa la caja de texto se bloquea con «Tu agente de urbnbeeai está contestando esta conversación» y el botón «Desactivar IA y escribir yo», como en tu compositor. En la lista de mensajes sale la etiqueta «IA».

**Datos del anuncio para el agente** (ya en `GET /listings?hostId=` y `GET /listings/:id`): además de lo de antes, `description`, `address {line, zone, city, county, state, country, lat, lng, public_precision}`, `bedrooms`, `bathrooms`, `amenities`, `min_nights`/`max_nights`, `weekend_price`, `cleaning_fee`, `cleaning_service_on`, `check_in_time`, `check_out_time`, `arrival_guide {share_only_with_confirmed_guests: true, check_in_method, directions, wifi_name, wifi_password, house_manual, checkout_instructions}`, **`ai_faq [{question, answer}]`** y **`ai_notes`** (los escribe el anfitrión en la pestaña «Agente IA» de su anuncio; el anuncio público no los muestra), `updated_at`.
- **Dirección exacta (regla del founder, 2026-10-04):** `address.full` siempre trae la dirección exacta completa (calle, número exterior, `unit` = número interior/depto, colonia, ciudad, estado, país). Cabibee ya no deja publicar un anuncio sin ella; `address.complete = false` marca anuncios viejos a los que les falta.
  - **En el chat el agente sólo dice la dirección exacta (calle, número e interior) si:** (a) `address.exact_address_public = true` (el anfitrión eligió mostrarla en su anuncio), o (b) el huésped de esa conversación tiene una reserva **confirmada** en ese anuncio.
  - En cualquier otro caso, sólo `address.approximate` (colonia, ciudad, estado) y que la dirección exacta se comparte al confirmar la reserva.
  - `arrival_guide` (wifi, cómo entrar) sólo con reserva confirmada, siempre.

**Limpiezas:** `GET /hosts/:hostId/cleanings?from=&to=&listingId=&status=` → `{id, listing_id, booking_id, date, next_check_in, status: pending|done|cancelled, assigned_to: host|team_member|null, guest_name, note, done_at, photos}`. Las reservaciones siguen en `GET /hosts/:hostId/bookings`. Desde 2026-10-04 cada limpieza trae también `assignee_id` y la respuesta trae `cleaners` (§9.7).

### 9.7 Permisos del agente (lado Cabibee listo 2026-10-04)

**Qué pidió el founder:** al conectar, el anfitrión de Cabibee elige qué puede hacer el agente (aceptar reservas, firmar contratos, limpiezas, etc.).

**Dónde los elige:**
- En la pantalla de «Permitir» del flujo de conexión (§8.1).
- Después, cuando quiera, en Integraciones. Los cambios aplican al momento.
- Al desconectar se borran; la próxima conexión empieza con los de omisión.

**Claves** (las mismas en toda la API):

| Clave | Qué deja hacer | Por omisión |
|---|---|---|
| `listings` | Ver anuncios, disponibilidad, cotizar. No se puede apagar. | sí |
| `messages` | Chat de §9.6: recibir `message.created`, leer conversaciones, contestar, cambiar el modo IA, `chat-channel`. | sí |
| `booking_links` | `POST /listings/:id/booking-link`, `POST /booking-leads`, y ver sólo las reservas que nacieron de sus ligas (`GET /bookings?ref=`, `/bookings/:id` con `ref`, `guest-requirements`). | sí |
| `bookings_view` | Ver todas las reservas del anfitrión (`GET /hosts/:hostId/bookings`, `/bookings/:id`). | sí |
| `bookings_decide` | **Nuevo:** aceptar o rechazar solicitudes pendientes. Prende `bookings_view`. | no |
| `contracts_sign` | **Nuevo:** firmar contratos en nombre del anfitrión. Prende `bookings_view`. | no |
| `cleanings_view` | `GET /hosts/:hostId/cleanings`. | sí |
| `cleanings_manage` | **Nuevo:** agregar, asignar, cambiar fecha u hora, elegir quién limpia cada anuncio, marcar hecha o cancelar limpiezas. Prende `cleanings_view`. | no |
| `cleanings_coordinate` | **Nuevo:** escribirle a quien limpia y leer sus respuestas (hilos con el equipo de limpieza). Prende `cleanings_view`. | no |

**Cómo los lees:**
- `GET /v1/host/:hostId` → `permissions {clave: bool}` y `permissions_updated_at`.
- `POST /v1/hosts/link` también los devuelve.
- Webhook nuevo **`host.permissions_changed`** (mismo sobre y firma de §9.4) con `data {permissions, updated_at}` cada vez que el anfitrión los cambia.
- Sin permiso → **403** `{code: "permission_denied", permission: "<clave>"}`. No reintentes; dile al anfitrión que lo prenda en Cabibee → Integraciones.

**Lo que deja de llegar sin permiso:**
- Sin `messages`: no llegan `message.created` ni `conversation.ai_changed`, y la IA sale `available:false` en todas las conversaciones.
- Sin `bookings_view` (y sin `booking_links` para esa reserva): no llegan los `booking.*` de esa reserva.

**Rutas nuevas 🔒** (Bearer + `X-Beeagent-Customer-Id` + vínculo + permiso). Todas aceptan `Idempotency-Key`.

| Método | Ruta | Permiso | Qué hace |
|---|---|---|---|
| POST | `/hosts/:hostId/bookings/:bookingId/accept` | `bookings_decide` | Acepta la solicitud **tal como la pidió el huésped** (sin cambiar fechas). Mismas reglas que el botón del anfitrión: noches libres, motor activo, pago registrado; el contrato queda firmado. Responde `{ok, booking, balance_due, refunded, currency}`. |
| POST | `/hosts/:hostId/bookings/:bookingId/reject` | `bookings_decide` | Rechaza. Si estaba pagada, primero se le devuelve al huésped (y el pase de membresía). `{ok, booking, refund}`. |
| POST | `/hosts/:hostId/bookings/:bookingId/sign` | `contracts_sign` | Firma el contrato pendiente del anfitrión. Si ya estaba firmado → `200 already_signed:true`. Sin contrato → `409 no_contract`. |
| POST | `/hosts/:hostId/cleanings` | `cleanings_manage` | Limpieza extra: `{listing_id, date, note?, assignee_id?}` → `201 {cleaning}`. |
| PATCH | `/hosts/:hostId/cleanings/:cleaningId` | `cleanings_manage` | `{status?: "done"\|"pending"\|"cancelled", note?, assignee_id?: "host"\|id\|null, date?: "YYYY-MM-DD", time?: "HH:MM"\|null}` → `{cleaning}`. Si el anfitrión pide foto para cerrar, `done` sin foto → 400. Fecha pasada u hora inválida → 400. Una fecha movida queda fija (`date_moved:true`): ya no la regresa la reserva. |
| PATCH | `/hosts/:hostId/cleanings/listings/:listingId` | `cleanings_manage` | Quién limpia ese anuncio por omisión: `{default_cleaner_id: "host"\|id\|null}` → `{cleaners, listings, settings}`. Alguien que no es del equipo de limpieza → 400. |
| POST | `/hosts/:hostId/cleanings/:cleaningId/message` | `cleanings_coordinate` | Le escribe a la persona asignada: `{body, client_message_id?}` → `201 {conversation_key, guest_session_id, team_member_id, message}`. Le llega aviso. Si la hace el anfitrión o nadie → `409 no_cleaner`; si el anfitrión apagó la IA en ese hilo → `409 ai_disabled`. |

**Coordinar limpiezas:**
- `GET /hosts/:hostId/cleanings` trae también, por limpieza, `time`, `date_moved` y `cleaner_guest_session_id` (el hilo con quien limpia). La respuesta trae `cleaners [{id, name, listing_ids}]`, `listings [{id, title, in_cleaning_tool, default_cleaner_id}]` y `settings {assign_mode, require_photo}`.
- Los hilos con el equipo de limpieza son conversaciones normales de §9.6, con `guest_session_id = gu_<usuario>`, pero piden `cleanings_coordinate` en lugar de `messages`. En `message.created`, `conversation.ai_changed`, la lista y el detalle de conversaciones viene `counterpart: "guest"|"cleaning_team"` y `team_member_id`.
- Con `cleanings_coordinate` y sin `messages`, sólo ves los hilos con limpieza (y al revés).
- Con quien limpia, el agente sólo habla de la limpieza: horario, accesos, fotos, cambios. Nada de datos de pago ni de otros huéspedes.

**Firma al aceptar:** el agente firma con el nombre legal del contrato del anuncio y en la bitácora del contrato queda «Agente IA de urbnbeeai firmó en nombre del anfitrión». Puede aceptar si tiene `contracts_sign`, **o** si el anfitrión ya firmó por adelantado el contrato de ese anuncio. Si no → **409 `host_signature_required`**.

**Errores de aceptar/rechazar** (`code`): `not_pending`, `not_paid`, `engine_off`, `listing_unavailable`, `blocked`, `overlap`, `refund_failed`, `host_signature_required`.

**El anfitrión se entera:** cada aceptación, rechazo o firma del agente le manda un aviso en Cabibee («Tu agente IA aceptó una reserva», etc.).

**Regla para el bot:** aceptar, rechazar o firmar son decisiones del anfitrión que él delegó. Hazlo sólo cuando su configuración en urbnbeeai lo pida (por ejemplo, «acepta solicitudes que cumplan X»). Nunca porque un huésped lo pida en el chat.

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
| C11 | Chat del anuncio ↔ central de chat de urbnbeeai y botón de IA (§9.6). Lado Cabibee listo 2026-10-03. | Canal entrante del lado urbnbeeai |
| C12 | Permisos del agente que elige el anfitrión y acciones nuevas (aceptar, rechazar, firmar, limpiezas) (§9.7). Lado Cabibee listo 2026-10-04. | Que urbnbeeai lea `permissions` |

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
| 2026-10-06 | **Para Cabibee: cómo quedaron los chats con fotos y audios en la app de urbnbeeai** | **Pedido del founder:** que sepas cómo resolvimos que los chats de la app (PWA, `apps/mobile-pwa/` en `beeagent-ui`) no cargaran o se quedaran en blanco con fotos y notas de voz, ahora que tú también tienes 4 fotos + 4 audios por mensaje (`bd28184`). Sólo es referencia: tu modelo de adjuntos (archivo en disco + ruta) es distinto y en lo pesado es mejor que el nuestro.<br><br>**Cómo guardamos los medios:** en `messages.raw` (JSON) como `data:` URL en base64 (`src/lib/inbound-media.ts`). Se guarda el binario y no la URL del proveedor porque las de Twilio piden auth y las de Meta caducan. Tope de 5 MB por archivo al entrar.<br><br>**Lo que fallaba y cómo se arregló:**<br>1. **El hilo no abría ("Failed to fetch messages")** con una foto de ~678 KB: el `SELECT … ORDER BY` metía la columna `raw` al buffer de ordenar de MySQL → `ER_OUT_OF_SORTMEMORY`. Arreglo: dos consultas, primero sólo los `id` ordenados y luego `WHERE id IN (…)` (`fetchConversationMessages` en `src/app/api/messages/route.ts`, `e15ff63`). **Aplica a ti** si guardas mensajes o adjuntos grandes en MySQL: nunca ordenes filas con el blob adentro.<br>2. **Nunca mandamos `raw` al navegador.** El servidor lo convierte en `image_urls`, `audio_urls`, `video_urls` y `document_items`. La lista de chats no lee `raw` nunca; sólo el detalle del hilo.<br>3. **Fotos rechazadas por pesadas** (las del celular pesan 3–8 MB): la app las achica antes de subir, a 1600 px de lado y JPEG bajando calidad (0.88 → 0.38) hasta quedar en ~950 KB (`apps/mobile-pwa/src/lib/media-compress.ts`). El servidor acepta hasta ~2.8 MB por archivo. Esto es lo que más ayudó a que todo cargara rápido.<br>4. **Audios que no sonaban o no mostraban duración en iPhone** con `data:` URL largas: el reproductor convierte la `data:` URL a `Blob` → `URL.createObjectURL` y la libera al desmontar (`AudioMessage.tsx`). `<audio preload="metadata" playsInline>`. La onda se calcula del audio y mientras tanto se pinta una de relleno, para que la burbuja no brinque.<br>5. **Grabar notas de voz:** `MediaRecorder` con el primer formato que el navegador soporte: `audio/webm;codecs=opus`, `audio/webm`, `audio/mp4` (Safari sólo graba `mp4`). Grabar → pausar → escuchar → enviar, como WhatsApp (`VoiceNoteComposer.tsx`).<br>6. **La lista "Cargando…" cada vez que regresabas al inbox:** caché en memoria por pantalla. Se pinta lo último que había y se refresca en silencio; el "Cargando" sólo sale la primera vez (`useResource.ts`, `threadCache.ts`).<br>7. **El chat abierto se vaciaba** cuando fallaba un refresco (señal mala): un error sólo se muestra si nunca hubo datos; si ya había mensajes, se quedan en pantalla (`8553f5e`).<br>8. **Mensajes nuevos que tardaban:** se refresca cada 5 s el chat abierto y cada 12 s la lista, sólo con la app visible, y además al volver a la app (`focus`, `visibilitychange`, `pageshow`) y cuando llega un push (el service worker avisa a la ventana con `PUSH_RECEIVED`). Lista en páginas de 100 con `before_message_id`.<br>9. **Chats borrados que volvían a salir:** el borrado se quita de la lista al instante, sin esperar al servidor (`removeCachedThread`), y si la primera página trae todo el inbox se reemplaza la lista en vez de mezclarla (`applyHeadPage` en `threadCache.ts`). En la web también se filtran los borrados aunque llegue un refresco viejo (`220147d`, `5925188`).<br><br>**Lo que no copiaría:** el refresco de 5 s baja el hilo completo con todas las fotos en base64 cada vez. Con pocos medios funciona; con muchos, pesa. Tú no tienes ese problema porque sirves cada adjunto por su ruta, y tu `privateFileResponse` (`web/lib/file-response.ts`) ya hace lo que haría falta: caché privada de 7 días e `immutable`, y `Range`/`206` para que Safari reproduzca los audios. Mantenlo así: que el JSON de mensajes lleve sólo la ruta del adjunto (nunca el binario) y que todo adjunto nuevo (chats, estancia, equipo) pase por esa función. | Revisión de código en `beeagent-ui` (`main`). Sin cambio de código en ninguno de los dos repos. |
| 2026-10-04 | **Para Cabibee: huésped desde otro número** | **Decisión del founder:** un huésped ya hospedado puede escribirle al bot desde otro número o canal y preguntar por el wifi, qué hay cerca o cómo funcionan las cosas del depa. El bot le contesta, sin dar nunca datos que sólo son del anfitrión.<br><br>**Ya en urbnbeeai:**<br>- Sin verificar, el bot sólo da lo general: zona, `ai_faq`, `ai_notes`, reglas y horarios.<br>- Para la calle y la `arrival_guide`, pide el **código de reservación** (el `token` de 6 dígitos que el huésped ve en `/finish` y en su contrato) y su primer nombre. Nunca lo guarda ni lo repite.<br>- Sólo guarda `booking_id` para esa conversación hasta el `check_out`, y re-checa con `GET /bookings/:id` cada vez.<br>- Topes de intentos fallidos: 3 por conversación en 24 h y 10 por anfitrión en 1 h. Pasado eso, o si no se puede verificar, le avisa al anfitrión para que conteste él.<br>- Nunca da teléfono, email, nombre completo u otras direcciones del anfitrión, ni datos de otros huéspedes o del equipo.<br><br>**Pedido, bloqueante para esto:** `POST /hosts/:hostId/bookings/verify-guest {code, first_name}` → `200 {match: false}` o `{match: true, booking: {booking_id, listing_id, check_in, check_out, status}}`.<br>- Sólo reservas de ese anfitrión.<br>- `first_name` sin acentos ni mayúsculas, contra el primer nombre de la reserva.<br>- Mejor si sólo cuentan reservas no terminadas (`check_out >= hoy`).<br>- Sin decir si falló el código o el nombre.<br>- Con tu propio tope por anfitrión: el código también abre contrato y pago, y son 6 dígitos.<br>- Permiso: `listings`, porque es para contestarle a un huésped suyo, no para ver reservas.<br>Mientras no exista, urbnbeeai recibe 404 y le avisa al anfitrión.<br><br>**Sugerencia:** en la pestaña «Agente IA», avisar que `ai_faq` y `ai_notes` las puede leer **cualquiera** que pregunte, y que códigos de acceso y wifi van en la guía de llegada. | `tsc --noEmit`, 15 pruebas unitarias (código bueno y malo, sin confirmar, topes, cancelada después). |
| 2026-10-04 | urbnbeeai: C12 lectura ✅ + respuestas del founder | **Permisos (§9.7):**<br>- urbnbeeai lee `permissions` / `permissions_updated_at` de `GET /v1/host/:hostId` al vincular y escucha `host.permissions_changed`. Guarda la copia sólo si su `updated_at` es más nuevo y lee igual que tu `sanitizeBotPermissions`.<br>- Sin `booking_links`, el bot no manda ligas ni pasa solicitudes.<br>- Un 403 `permission_denied` no se reintenta: urbnbeeai vuelve a leer los permisos y le avisa al tenant que lo prenda en Integraciones.<br>- Todavía **no** usa `accept`/`reject`/`sign` ni las limpiezas: el bot nunca lo hará por lo que pida un huésped, y la regla del anfitrión en urbnbeeai aún no existe. Commit `3c79e69` de beeagent-ui.<br><br>**Respuestas del founder a §11:**<br>- **Q1:** la comisión por reserva es de Cabibee.<br>- **Q2:** la moneda la decide el anfitrión.<br>- **Q3:** sin motor pagado, el bot sigue contestando pero sólo informa. Si alguien quiere reservar, trata de retenerlo sin prometer fechas y le avisa al anfitrión. En Cabibee no se puede reservar (ya es así).<br><br>**Pedido:** con motor activo y `booking_approval_mode = approval`, que Cabibee avise de la solicitud por aprobar también a los **colaboradores** del anfitrión que pueden aprobar, no sólo al anfitrión. urbnbeeai ya avisa al tenant con `booking.requested` + `PENDING_HOST`.<br><br>**Precios:** el bloqueo pedido el 2026-10-03 ya está en producción (commit `abffb7a`). El `PATCH .../admin/catalog/{sku}` responde 410 `cabibee_prices_owned_by_cabibee`. | `tsc --noEmit`, `eslint`, 5 pruebas unitarias. Falta QA contra prod con un anfitrión vinculado. |
| 2026-10-04 | **Para urbnbeeai: coordinar limpiezas** | **Decisión del founder:** el agente también puede coordinar limpiezas si el anfitrión lo permite. Permiso nuevo `cleanings_coordinate` (apagado por omisión). Contrato en §9.7.<br>- **Rutas nuevas:** `POST /hosts/:hostId/cleanings/:id/message` (escribirle a quien limpia) y `PATCH /hosts/:hostId/cleanings/listings/:listingId` (quién limpia el anuncio).<br>- `PATCH /hosts/:hostId/cleanings/:id` acepta `date` y `time`.<br>- Las respuestas de quien limpia llegan como `message.created` con `counterpart: "cleaning_team"`.<br><br>**Falta de tu lado:**<br>1. separar en urbnbeeai los hilos `cleaning_team` de los de huéspedes;<br>2. al mover una limpieza, avisarle a quien limpia con `/message`. | `tsc`, `next build`. Prueba de permisos 84/84: sin permiso → 403; mensaje con aviso; respuesta con `counterpart`; `no_cleaner`; `ai_disabled`; la fecha movida no la regresa la reserva; hora y fecha inválidas → 400; quién limpia por anuncio. Regresión: chat urbnbeeai 68, herramientas 83, carrito 34, reseñas 45. |
| 2026-10-04 | **Para urbnbeeai: permisos del agente** | **Decisión del founder:** el anfitrión elige qué puede hacer el agente: al conectar (pantalla «Permitir») y después en Integraciones. Contrato completo en §9.7.<br>- **Por omisión:** chat, ligas, ver reservas y ver limpiezas. Aceptar/rechazar, firmar contratos y organizar limpiezas empiezan **apagados**.<br>- Sin permiso, la API responde `403 permission_denied` con la clave que falta.<br>- `GET /host/:hostId` trae `permissions`; webhook nuevo `host.permissions_changed`.<br>- **Rutas nuevas:** `POST /hosts/:hostId/bookings/:id/{accept,reject,sign}`, `POST /hosts/:hostId/cleanings`, `PATCH /hosts/:hostId/cleanings/:id`.<br><br>**Falta de tu lado:**<br>1. leer `permissions` al vincular y escuchar `host.permissions_changed`;<br>2. no ofrecer en urbnbeeai acciones que el anfitrión no permitió, y tratar `permission_denied` como «pídele al anfitrión que lo prenda»;<br>3. si quieres que el agente acepte o rechace, la regla la pone el anfitrión en urbnbeeai, nunca el huésped. | `tsc`, `next build`. 59 casos con anfitrión vinculado: 403 por cada permiso, webhook de cambio, aceptar sin firma → 409, con firma o firma por adelantado → aceptada y firmada por el agente, rechazo, idempotencia, limpiezas, chat apagado sin webhooks, sólo ligas, conectar con permisos y desconectar. Suites anteriores sin fallas. |
| 2026-10-04 | **Para urbnbeeai: dirección exacta** | **Decisión del founder:** todo anuncio tiene la dirección exacta en el sistema, aunque el público sólo vea la aproximada antes de reservar (la aproximada es sólo para el anuncio). Cabibee exige calle, número exterior y, en departamentos, número interior para publicar. `GET /listings/:id` trae `address.full`, `address.unit`, `address.complete`, `address.exact_address_public` y `address.approximate` (§9.6).<br><br>**Regla para el chat de urbnbeeai:** el agente dice la dirección exacta **sólo** si hay una reserva confirmada de ese huésped en ese anuncio (`GET /bookings?ref=` o `GET /hosts/:hostId/bookings`), **o** si `address.exact_address_public = true`. Si no, sólo la zona (`address.approximate`) y que la dirección exacta llega al confirmar. La guía de llegada (wifi, acceso) sólo con reserva confirmada. | `tsc`, `next build`. Prueba de socio: publicar sin dirección → 400; `address.full` con interior; `exact_address_public` según lo que elige el anfitrión. |
| 2026-10-03 | **Para urbnbeeai: precios** | **Decisión del founder:** de ahora en adelante urbnbeeai **sólo modifica el precio de su conexión con Cabibee** (la tool `tool_host`, hoy $100/mes). **No modifica los precios de los productos de Cabibee** (membresías del huésped, planes del anfitrión, motor de reservas, anuncio destacado, Tienda). Cabibee ya decide sus precios sólo de su lado: su sincronización con `pricing_catalog` está apagada (`CATALOG_SYNC_ENABLED = false`) y su `/admin/pricing` ya no escribe en urbnbeeai. Pedido para urbnbeeai:<br>- quitar o bloquear la edición de los SKUs `provider = cabibee` en su admin y en el `PATCH /v1/admin/catalog`;<br>- que sus vendedores no fijen precio ni piso a productos de Cabibee.<br>Esto reemplaza D6–D8 para los productos de Cabibee (§1). | Sin cambio de código en Cabibee: ya era así. |
| 2026-10-03 | C11 (lado Cabibee) | **El chat de Cabibee ya se puede conectar a tu central de chat.** Contrato completo en §9.6:<br>- webhooks `message.created` y `conversation.ai_changed`;<br>- API de conversaciones, respuesta del agente (`via:"ai"`), modo IA por conversación (`ai_replies_enabled`, con `if_match_updated_at`) y adjuntos;<br>- `PUT /hosts/:hostId/chat-channel {enabled:true}` cuando ya lo recibas.<br>En Cabibee el anfitrión tiene el mismo botón «Desactivar IA» por conversación que en urbnbeeai.<br><br>**Datos nuevos del anuncio:** dirección completa con lat/lng, guía de llegada, horarios, amenidades, limpieza, y **preguntas frecuentes + información general** que el anfitrión escribe para su agente (`ai_faq`, `ai_notes`). Nuevo `GET /hosts/:hostId/cleanings`.<br><br>**Falta de tu lado:**<br>1. un canal entrante «Cabibee» en tu central de chat que reciba `message.created`;<br>2. que el agente conteste con `POST .../messages` sólo si `ai_replies_enabled`;<br>3. que tu interruptor de IA de esas conversaciones llame `POST .../ai` y respete `conversation.ai_changed`;<br>4. que el agente use `ai_faq`/`ai_notes`/`address`/`arrival_guide` del anuncio, y la guía y la calle sólo con reserva confirmada;<br>5. `PUT chat-channel {enabled:true}`. | `tsc`, `eslint`, `next build`. Prueba local con secreto de socio y anfitrión vinculado: webhooks firmados recibidos en un receptor de prueba, respuestas de la API, 409 con IA apagada, idempotencia, conflicto, adjuntos, permisos. |
| 2026-09-30 | urbnbeeai U3 ✅ | **Conectar por redirección ya está del lado de urbnbeeai.** Botón «Conectar Cabibee» → tu `/host/settings/integrations/connect?return_url=&state=`. `return_url` = `https://www.urbnbeeai.com/integrations/cabibee/callback`. El `state` va firmado en cookie (15 min). Al volver, se llama `POST /v1/hosts/link` con el código. `/integrations/cabibee/start` es la pantalla de «Activar agente IA» (login + elegir agente). Desconectar llama `DELETE /v1/hosts/:hostId/link` y antes `POST .../agent-status` `{active:false}`. Vincular o prender/apagar la tool manda `agent-status`. El código pegado a mano sigue de respaldo. | `tsc --noEmit`. Casos de firma del `state` (mismo nonce / nonce ajeno / cookie rota). Falta QA en navegador contra tu C8 en prod. |
| 2026-09-30 | C7 | Precios desde `pricing_catalog` de urbnbeeai. `/admin/precios` → `/admin/pricing`: GET/PATCH al catálogo (Bearer + `X-Cabibee-Admin-Email`). JSON solo caché + `stripeProductId`. Caché 5 min, último valor si falla. Piso solo en admin. Checkout sigue con `price_data` del catálogo. Incluye `booking_engine`. Sin C11. Q1–Q3 abiertas. | `tsc --noEmit`. GET público 200 (6 SKUs). GET admin 200 (con `floor_price`). Parse: plan público sin piso. |
| 2026-09-29 | QA | Pago host: `verify-session` lee la sesión en el Stripe que cobró (anfitrión o Cabibee). `/viajes` en cabibee.com redirige a confirmar. Quote/request sin cargo de plataforma si el host cobra en su Stripe (misma regla que Checkout; Q1 sigue abierto). Reserva existente no pide membresía otra vez (`usedMembershipPass` / ya existe). Cerré `bkg_90c494ed5dcedf50a67d` con la sesión ya cobrada; no reembolsé ni volví a cobrar. | `tsc`. `verify-session` en prod → CONFIRMED/paid + C10. `/viajes?session_id=` → confirm. |
| 2026-09-29 | C10 | Cola saliente HMAC a urbnbeeai. Eventos de reserva, unlink y entitlements Cabibee. Sin C11. | `tsc --noEmit`. Casos de firma/clasificación 200/400/401/503. |
| 2026-09-29 | C1–C9 | Código de C1–C9 a `main`/Railway (antes solo local). Arranque aplica `002`–`004` + `json-to-mysql`. Sin C10/C11. | `tsc --noEmit`. Push `main` → autodeploy Urbnbee Rentals. |
| 2026-09-29 | urbnbeeai U2 | urbnbeeai etiqueta `metadata.app="urbnbee"` e ignora lo tuyo en su webhook (también tus objetos viejos con `metadata.userId`). | Deploy SUCCESS |
| 2026-09-29 | urbnbeeai U1 | La tool se llama Cabibee y apunta a `https://cabibee.com`. Manda `X-Beeagent-Customer-Id` en **cada** llamada a `/v1`. Ya no acepta host ID a mano. Muestra el 409 `host_exists_confirm_required` como "usa un código". | Deploy SUCCESS |
| 2026-09-29 | urbnbeeai U5+U6 | Catálogo con tus 5 planes + motor, en MXN y USD, y la API de §7 en producción. | 31 casos contra la base de prod; deploy SUCCESS |
| 2026-09-29 | urbnbeeai U8 | Receptor de webhooks de §9.4 en producción. **C10 desbloqueado.** | 27 casos contra la base de prod con un agente de prueba |
| 2026-09-29 | urbnbeeai U7 | El bot ya usa tu v2:<br>- `POST /listings/:id/quote` y `GET /availability` para cotizar y sugerir otras fechas.<br>- `POST /booking-link` con `Idempotency-Key` y `conversation_key`. La liga sale en un mensaje aparte y el `ref` se guarda del lado de urbnbeeai.<br>- `GET /bookings?ref=` sólo para refs emitidos en la misma conversación.<br><br>No usa `GET /hosts/:id/bookings` en el chat, porque el bot habla con huéspedes. `guests` se manda tal cual lo dice el huésped. | 16 casos con host stub contra la base de prod. Contra cabibee.com: listing inexistente → 404 manejado. **Aún no hay un anfitrión real vinculado**, así que falta la prueba de punta a punta. |
| 2026-09-29 | urbnbeeai QA | Anfitrión de prueba real en prod:<br>- cuenta `qa-host-urbnbeeai@cabibee.com` (`usr_ea7d6a7edc87d6896b1a4cb7`), registrada por `/api/auth/register`;<br>- anuncio `lst_ab52066bb98b5b99278eb03c` "PRUEBA urbnbeeai — no reservar", publicado e instantáneo, 1000 MXN/noche, hasta 4 huéspedes;<br>- vinculado con código al workspace 11 (agente Lab 22).<br><br>El anuncio sale `not_bookable` porque el anfitrión no tiene Stripe: `PUT /api/host/settings/payments` responde 503 por falta de `HOST_PAYMENT_CREDS_KEY` en prod. **La pone el founder.** Después, urbnbeeai conecta ahí su llave `sk_test` y corre la prueba de punta a punta. No borres esa cuenta ni ese anuncio. | Registro, login, anuncio, link-code y `POST /hosts/link` en 200. Quote y booking-link responden `not_bookable`, como se esperaba. |
| 2026-09-29 | urbnbeeai U7 ✅ | **Punta a punta verificado.** Después de tu arreglo, el bot reporta `bkg_90c494ed5dcedf50a67d` como `CONFIRMED` / `paid` / 3,200 MXN. `booking.confirmed` y `booking.paid` llegaron `processed` y avisaron al tenant (4 avisos en total). Esas noches ya salen `unavailable`, con alternativas libres. `tool_host` ya cuesta $100/mes en urbnbeeai.<br><br>**Detalle menor:** una reserva instantánea confirmada y pagada sigue con `contract_status: pending`, porque falta `hostAcceptedAt`. El bot le diría al huésped "contrato pendiente" en una reserva lista. Si en las instantáneas el anfitrión acepta al confirmarse, conviene marcarlo. | Consulta del bot, `cabibee_webhook_events` y `tenant_notifications` 785–786. |
| 2026-09-29 | urbnbeeai QA | **Bug P0: los pagos al Stripe del anfitrión nunca se confirman por el regreso.** La huésped QA pagó `bkg_90c494ed5dcedf50a67d` con la tarjeta de prueba (sesión `cs_test_a1tEsiIHOYmo8svYI9s8X31MZn2Mg5d3svPgEngCWISJ9B56ZXXpHdY19O`, `chargedVia: host`). Sigue `AWAITING_PAYMENT`, sin pagar.<br>- `POST /api/bookings/verify-session` usa `getStripe()` (la cuenta de Cabibee) para `sessions.retrieve`, pero la sesión vive en la cuenta del anfitrión → **502 "No se pudo verificar el pago."** Arreglo: buscar la reserva por `client_reference_id` o por `stripeCheckoutSessionId`, y usar `getHostStripe(booking.hostId)` cuando `chargedVia === "host"`. Así, confirmar sólo depende de que el anfitrión haya configurado bien su webhook.<br>- **404 después de pagar:** `contract-view-client.tsx` manda `returnPath: "/viajes"`, que no existe (`cabibee.com/viajes?session_id=…` da 404). Esa es la página que debía llamar a verify-session.<br><br>Cuando lo arregles, vuelve a verificar esa sesión: debe quedar `CONFIRMED` / `paid` y salir `booking.paid` / `booking.confirmed` por C10. | `verify-session` con esa sesión → 502; captura del 404 en `/viajes`. |
| 2026-09-29 | urbnbeeai QA | **Bug de montos:** cuando el anfitrión cobra con su propio Stripe, `checkout` le quita el cargo de plataforma (`feeCents = 0`) y Stripe Checkout cobra **3,200 MXN**. Pero `POST /quote` y el webhook `booking.*` dicen `total` **3,232**, con el cargo de 32 incluido; `GET /bookings?ref=` dice 3,200. El bot le cotizó 3,232 al huésped. Arreglo sugerido: que quote, webhook y bookings usen la misma regla que `checkout` (sin cargo de plataforma si `getHostStripe(hostId)` existe), o que checkout sí lo cobre. La decisión del cargo es del founder (Q1). | Captura de Stripe Checkout `cs_test_…`: MX$3,200.00. |
| 2026-09-29 | urbnbeeai QA | **C10 funciona.** La huésped QA reservó con `bl_100e10d240083a00` (`bkg_90c494ed5dcedf50a67d`, 3,232 MXN). `booking.requested` llegó a urbnbeeai, quedó `processed` y avisó al tenant en la conversación correcta. **Bug en `guestRequirementsOf`:** justo después de reservar con pase dice `next_step: membership`, porque el pase ya se gastó en esta misma reserva. Si la reserva tiene `usedMembershipPass`, o si ya existe, la membresía no debería volver a pedirse; el paso correcto era `contract`. Así el bot le manda al huésped la liga de membresía en vez de la del contrato. | Script contra prod; filas en `cabibee_webhook_events`, `cabibee_bookings` y `tenant_notifications` (id 783). |
| 2026-09-29 | urbnbeeai QA | **Bug:** con pase, `resolveGuestBookingAccess` pide identidad (`needsIdentity`), pero `POST /api/verification/identity/start` exige `subscriptionStatus` active o trialing y responde 409 "Activa tu membresía de verificación". Quien compra un pase nunca puede verificarse ni reservar. Arreglo sugerido: dejar iniciar Identity también con `bookingPassesRemaining > 0`. **Para la prueba** (el founder pide datos ficticios):<br>- si tu Stripe está en modo prueba, basta con arreglar el bug; urbnbeeai usa los botones de prueba de Stripe Identity ("verificar"), sin documento real;<br>- si está en modo real, no se meten datos falsos a Stripe; marca a `usr_b2f325101ff4b5b5161d2dfd` como verificada a mano (pedido de abajo).<br><br>Anota aquí cuál de los dos aplica. | `identity/start` → 409 con la huésped QA con pase. |
| 2026-09-29 | urbnbeeai QA | Gracias por el pase. Ahora `POST /api/bookings/request` da 403 `needsIdentity`: la huésped QA no puede pasar Stripe Identity con un documento real. **Pedido:** márcala como verificada por admin (`kycStatus: "verified"`, que se note que fue manual, sólo en `usr_b2f325101ff4b5b5161d2dfd`). Con eso urbnbeeai sigue: reserva con `bl_100e10d240083a00`, firma, paga con la tarjeta de prueba y revisa C10. | Script contra cabibee.com: login 200, request 403 `needsIdentity`. |
| 2026-09-29 | urbnbeeai QA | Con `HOST_PAYMENT_CREDS_KEY` puesta, el anfitrión QA tiene Stripe (`sk_test` de urbnbeeai, con webhook placeholder) y el anuncio es reservable. El bot probado contra prod:<br>- quote de 3 noches en 3,232 MXN (3,000 de estancia + 200 de limpieza + 32 de cargo);<br>- 6 huéspedes → `max_guests`;<br>- `bl_100e10d240083a00` creado con `conversation_key` `test:qa-u7-live-b`;<br>- `GET /bookings?ref=` → `next_step: register`.<br><br>**Pedido 1, bloqueante:** dale **un pase por reserva sin cobro** a la huésped QA `qa-guest-urbnbeeai@cabibee.com` (`usr_b2f325101ff4b5b5161d2dfd`), que hoy da 403 `needsMembership`. Con eso, urbnbeeai reserva con ese `ref` (30 oct → 2 nov), firma, paga con la tarjeta de prueba de Stripe y verifica tu C10 contra nuestro receptor.<br><br>**Pedido 2, sugerencia:** `rememberPartnerIdempotency` guarda también las respuestas 4xx y 5xx por 24 h. Un 409 `not_bookable` repetía el mismo rechazo aunque el anuncio ya estuviera listo. urbnbeeai ya lo esquiva (la llave cambia por mensaje), pero conviene guardar sólo las 2xx. | Scripts contra cabibee.com; filas en `cabibee_booking_links` de urbnbeeai. |
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
