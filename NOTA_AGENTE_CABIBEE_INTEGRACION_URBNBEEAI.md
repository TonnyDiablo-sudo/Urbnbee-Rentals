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

### 2.2 El pago de una reserva puede no registrarse

`app/api/webhooks/stripe/route.ts` solo procesa membresía (`mode === "subscription"`) y Stripe Identity. La reserva se marca pagada **solo** si el huésped regresa a `/bookings/confirm` (`POST /api/bookings/verify-session` → `completeBookingAfterPayment`). Si paga y cierra la pestaña, se queda en `AWAITING_PAYMENT` aunque Stripe ya cobró.

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

`lib/beeagent-partner.ts`: un solo secreto compartido (`URBNBEE_PARTNER_API_SECRET`) más un `hostId` que manda urbnbeeai. Hoy solo expone datos públicos, pero en cuanto exponga reservas y huéspedes, **cualquier error del lado de urbnbeeai expondría datos de otro anfitrión**.

**Qué hacer:** toda ruta con datos privados (reservas, huéspedes, pagos, estado de membresía) exige:
1. el Bearer del secreto de socio (autentica a urbnbeeai como plataforma), **y**
2. el header `X-Beeagent-Customer-Id`, **y**
3. que exista un vínculo activo en la tabla de vínculos entre ese `hostId` y ese `beeagent_customer_id`.

Si falta cualquiera: `403`. Así, aunque urbnbeeai se equivoque de ID, Cabibee no entrega nada que no esté vinculado.

Además, `POST /v1/hosts/provision` **enlaza por email sin comprobar nada**. Cualquiera que tenga en urbnbeeai el email de un anfitrión de Cabibee se quedaría con su cuenta. Quítale el enlace automático: si el email ya existe en Cabibee, responde `409 { code: "host_exists_confirm_required" }` y el enlace se hace por §8. Crear host nuevo por `provision` sí puede seguir (el huésped nunca lo usa; lo usa el vendedor de urbnbeeai al darle de alta un paquete), pero la cuenta nace sin contraseña y con `link` pendiente de confirmar por el anfitrión.

---

## 3. Qué vende Cabibee (catálogo)

| SKU (en `pricing_catalog` de urbnbeeai) | Quién lo compra | Qué incluye | Vendible por vendedores de urbnbeeai |
|---|---|---|---|
| `cabibee_booking_engine` | Anfitrión | Motor de reservas: cobro de la estancia **al Stripe del anfitrión** (§5), firma de contrato (§4.2), bloqueo de fechas y calendario, reserva manual o automática. **Incluye** `cabibee_host_verification`. | Sí |
| `cabibee_host_verification` | Anfitrión | Membresía de verificación de identidad del anfitrión (Stripe Identity) y sello "Verificado" en sus listings. | Sí |
| `cabibee_guest_membership` | Huésped | Membresía de verificación de identidad del huésped (la de `/membresia` hoy). | **No** (la compra el huésped en cabibee.com; se cataloga solo para que el admin edite el precio en un solo lugar) |

Y del lado de urbnbeeai, producto suyo (D9): `tool_cabibee` ($100/mes por omisión), la tool del bot.

Hoy **nada de esto existe como producto para anfitriones**. Solo se cobra la membresía del huésped (Price IDs en variables de entorno `STRIPE_PRICE_VERIFICATION_*`) y la comisión por reserva (`PLATFORM_BOOKING_FEE_PERCENT`). `urb_host_entitlements` existe en el esquema pero ningún código la usa.

### 3.1 Derechos (entitlements) del anfitrión

Cabibee es quien **hace cumplir** qué puede hacer cada anfitrión, así que Cabibee guarda los derechos:

- Tabla `host_entitlements`: `host_id`, `sku`, `status` (`active`, `past_due`, `cancelled`), `source` (`cabibee_direct` si lo compró en cabibee.com, `urbnbeeai_seller` si se lo vendió un vendedor de urbnbeeai), `stripe_subscription_id`, `current_period_end`, `updated_at`.
- `cabibee_booking_engine` activo ⇒ `cabibee_host_verification` activo (derivado; no se cobra aparte).
- Sin `cabibee_booking_engine`, el listing se sigue publicando como directorio (chat con el anfitrión, datos de contacto), pero **no** muestra "Reserva con cuenta" ni acepta `POST /api/bookings/request`.
- Quien creó la suscripción en Stripe es quien procesa sus webhooks (por `metadata.app`, §6) y le avisa al otro sistema: si la vendió urbnbeeai, urbnbeeai llama a `POST /v1/hosts/{hostId}/entitlements` (§9.3); si la compró el anfitrión en cabibee.com, Cabibee manda `host.entitlements_changed` (§9.4).

---

## 4. Motor de reservas (lo que incluye `cabibee_booking_engine`)

### 4.1 Precio

Ya existe: `lib/booking-helpers.ts` → `sumStayMxn` (precio por noche con `nightlyPriceOverrides`, más `cleaningFee`) y el cargo de plataforma en `lib/platform-fees.ts` → `platformBookingFeeMxn`. Consérvalo como **la única** función que calcula el total, y exponla por la API de cotización (§9.2). El bot nunca suma nada por su cuenta.

La moneda la decide Cabibee (D2). Hoy está fija en `mxn`; si la cambias por listing, que la cotización y el webhook la devuelvan siempre explícita.

### 4.2 Firma de contrato

**No existe hoy.** Mínimo viable:
- Plantilla de contrato por anfitrión (texto con variables: nombre del huésped, fechas, listing, total, reglas, política de cancelación). Opcional por listing.
- El huésped la acepta **antes de pagar**: nombre completo tecleado + casilla "Acepto" + fecha y hora + IP + user agent. Se guarda el texto exacto que aceptó (no la plantilla, que puede cambiar) y un hash SHA-256 de ese texto.
- PDF descargable para huésped y anfitrión.
- Estado `contract_status` en la reserva (§2.3).

### 4.3 Bloqueo de fechas

Ya existe `listing.blockedDates` (el anfitrión bloquea a mano) y el calendario público marca "Fechas reservadas". Falta que **las reservas activas bloqueen solas** las noches con el candado de §2.1, y que la disponibilidad que ve el bot (§9.2) salga de la misma fuente que el calendario. Importar/exportar iCal (Airbnb, Booking) queda para después.

---

## 5. Pagos de la estancia al Stripe del anfitrión (D3)

Hoy la estancia se cobra con Stripe Checkout en la cuenta de la plataforma (`STRIPE_SECRET_KEY`). Eso cambia: **la estancia se cobra en la cuenta de Stripe del propio anfitrión.**

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
- El webhook de plataforma de Cabibee (`app/api/webhooks/stripe/route.ts`) **ignora** (responde `200 { ignored: "not_cabibee" }`) cualquier evento cuyo objeto no tenga `metadata.app === "cabibee"`. Compatibilidad: acepta también los objetos viejos sin `app` pero con `metadata.userId`, que son las membresías de huésped creadas antes de este cambio.
- urbnbeeai hace lo mismo con `metadata.app = "urbnbee"`. Hoy urbnbeeai escucha `invoice.*` y guardaría como huérfanas las facturas de membresías de Cabibee; se arregla de su lado.
- Las cuentas de Stripe **de los anfitriones** (§5) no son la compartida: ahí no aplica este filtro, porque cada anfitrión tiene su propio webhook.

---

## 7. Precios: viven en urbnbeeai, Cabibee los lee y edita por API (D6–D8)

La fuente única de precios es `pricing_catalog` en urbnbeeai. Cada fila tendrá `provider` (`urbnbee` o `cabibee`), precio público (**techo**) y **piso**. Cabibee **no** guarda su propia copia de precios; solo un caché.

Del lado de urbnbeeai (lo construye el agente de urbnbeeai; aquí va el contrato para que Cabibee lo consuma):

| Método | Ruta en urbnbeeai | Para qué | Auth |
|---|---|---|---|
| GET | `/api/integrations/cabibee/v1/catalog` | Precios públicos de los SKU `provider=cabibee`: `sku`, `label`, `public_price`, `currency`, `interval`, `active`. **Nunca incluye el piso.** | Bearer `CABIBEE_TO_URBNBEEAI_API_SECRET` |
| GET | `/api/integrations/cabibee/v1/admin/catalog` | Igual más `floor_price`, `updated_at`, `updated_by`, `updated_from`. Solo para la pantalla de admin de Cabibee. | Mismo Bearer + header `X-Cabibee-Admin-Email` |
| PATCH | `/api/integrations/cabibee/v1/admin/catalog/{sku}` | Cambiar `public_price`, `floor_price` o `active`. **Solo SKUs `provider=cabibee`**; cualquier otro → `403`. Valida `floor_price <= public_price`. | Mismo Bearer + `X-Cabibee-Admin-Email` |

Lo que hace Cabibee:
- **Pantalla `/admin/precios`** (rol `admin`): lista los SKU de Cabibee con techo y piso, y los edita llamando al PATCH desde el **servidor** de Cabibee, nunca desde el navegador (el secreto no sale del servidor).
- Donde Cabibee muestra o cobra un precio (página de membresía, contratar motor de reservas), lo toma de `GET /catalog` con caché corto (5 min) y respaldo al último valor bueno si urbnbeeai no responde. Deja de usar los Price IDs fijos en variables de entorno: crea el Checkout con `price_data` y el monto del catálogo.
- El piso **nunca** aparece en páginas públicas, en el HTML ni en respuestas de API públicas de Cabibee.
- "El último que edita sobrescribe": como hay una sola copia, sale solo. Cada cambio queda auditado en urbnbeeai con quién, desde qué sistema y cuándo.
- Un cambio de precio **no** cambia lo que ya pagan los anfitriones con suscripción activa ni lo pactado por un vendedor; aplica a compras nuevas.

---

## 8. Conexión de cuentas Cabibee ↔ urbnbeeai (D10)

Lo que ya existe y se reutiliza: códigos de vinculación de 10 minutos (`lib/beeagent-host-link-store.ts`, `POST /api/host/integrations/beeagent/link-code`, pantalla `/host/settings/integrations`) y `POST /v1/hosts/link`.

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

### 9.4 Webhooks salientes Cabibee → urbnbeeai (no existen hoy)

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
| | | | |
