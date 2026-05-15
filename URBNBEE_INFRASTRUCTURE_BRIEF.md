# URBNBEE Infrastructure Brief — estado actual y requerimientos

## Resumen

URBNBEE hoy ya tiene una base funcional desplegable:

- App Next.js 16 en `web/`.
- Deploy en Railway.
- Dominio temporal `urbnbee.net` vía Cloudflare/Railway.
- Persistencia provisional en JSON dentro de un Railway Volume (`/data`).
- Uploads servidos desde volumen vía `/uploads/[...path]`.
- Stripe integrado parcialmente para suscripción/verificación de huésped.
- Motor de reservas básico con estados y persistencia en archivos.
- Base de código preparada para evolucionar hacia marketplace con MySQL.

La infraestructura actual sirve para MVP/demo, pero no para producción seria con pagos, identidad, contratos, depósitos y BeeAgent conectado. Para ese modelo se requiere mover persistencia crítica a base de datos, formalizar webhooks, separar dominios de responsabilidad y agregar proveedores externos.

## Estado actual

### Hosting

- Plataforma: Railway.
- Servicio: Next.js App Router.
- Runtime: Node >= 20.
- Build: Nixpacks con `npm run build`.
- Start: `npm run start`, que ejecuta `web/scripts/start.mjs`.
- Healthcheck: `/`.
- Dominio actual: `urbnbee.net`.

### Persistencia actual

Actualmente la app escribe datos en archivos JSON:

- `marketplace-store.json`: usuarios, hosts, listings.
- `bookings.json`: reservas.
- `guest-verification.json`: estado de verificación/suscripción.
- `host-inbox-messages.json`: mensajes.
- `blog-published-posts.json`: blog.
- `blog-bot-config.json`: configuración del blog bot.

En Railway esos archivos viven en:

- `URBNBEE_DATA_DIR=/data/json`
- `URBNBEE_UPLOADS_DIR=/data/uploads`

Esto evita perder datos en redeploys, pero tiene límites fuertes:

- No soporta bien concurrencia.
- No soporta varias réplicas.
- No hay transacciones.
- Riesgo de corrupción si dos requests escriben simultáneamente.
- No hay consultas robustas, índices ni auditoría real.

Regla actual: mientras se use JSON, mantener 1 sola réplica.

### Uploads

Hoy los uploads se guardan en volumen y se sirven desde:

- Ruta pública: `/uploads/...`
- Ruta interna: `getUploadsDir()`

Esto está bien para MVP, pero para producción conviene migrar fotos y documentos no sensibles a storage externo:

- Cloudinary.
- S3/R2.
- Railway Buckets cuando aplique.

No se deben guardar IDs oficiales, selfies ni documentos KYC en `uploads`. Eso debe vivir en el proveedor KYC.

### Auth

Auth actual:

- Cookie HTTP-only `urb_session`.
- Firma HMAC con `SESSION_SECRET`.
- Roles en app: guest / host / admin según tipos internos.
- Usuarios persisten hoy en `marketplace-store.json`.

Para producción:

- Mantener cookie HTTP-only.
- Mover usuarios y sesiones a DB.
- Agregar auditoría de login y cambios de seguridad.
- Preparar recuperación de contraseña/email verification.

### Stripe actual

Ya existe:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_VERIFICATION_MONTHLY`
- `/api/verification/checkout`
- `/api/webhooks/stripe`
- `/api/verification/status`
- `verification-store`

Actualmente la suscripción de verificación de huésped está parcialmente implementada. Falta:

- Stripe Identity o proveedor KYC real.
- Suscripción anual.
- Host packages.
- Add-ons.
- Stripe Connect / Mercado Pago marketplace para pagos a hosts.
- Webhooks completos para pagos, disputas, cancelaciones y depósitos.

## Requerimientos de infraestructura para el modelo objetivo

## 1. Base de datos transaccional

Necesario antes de manejar pagos reales, contratos, depósitos o BeeAgent conectado a disponibilidad.

Opción recomendada:

- Railway MySQL o Postgres.

El roadmap original menciona MySQL. Se puede mantener MySQL para alinearse con `beeagent-ui`.

Tablas mínimas:

- `users`
- `host_profiles`
- `guest_profiles`
- `listings`
- `listing_photos`
- `listing_availability`
- `host_plans`
- `host_plan_entitlements`
- `guest_memberships`
- `identity_verifications`
- `bookings`
- `booking_payments`
- `booking_contracts`
- `security_deposits`
- `reviews`
- `messages`
- `beeagent_links`
- `webhook_events`
- `audit_events`

Requerimientos técnicos:

- Transacciones para booking/payment.
- Índices por host, guest, listing, status y fechas.
- Idempotencia en webhooks.
- Audit log para acciones sensibles.
- Backups automáticos.

## 2. Storage de archivos

Separar tipos de archivo:

### Público / marketing

- Fotos de listings.
- Avatares.
- Imágenes de blog.

Proveedor recomendado:

- Cloudinary para MVP por transformaciones y CDN.
- S3/R2 si se quiere más control.

### Privado / legal

- Contratos PDF.
- Comprobantes de pago.
- Evidencia de daños.

Proveedor recomendado:

- S3/R2/Railway Bucket con URLs firmadas.

Reglas:

- Nunca servir documentos privados por URL pública directa.
- Usar rutas autenticadas o signed URLs.
- Guardar metadatos en DB, archivo en storage.

### KYC

- No almacenar IDs/selfies localmente.
- Guardar solo provider ID, status, timestamps y resultado.

## 3. Proveedor KYC

Opción MVP recomendada:

- Stripe Identity, porque ya existe Stripe en el stack.

Alternativas:

- Persona.
- Veriff.
- Sumsub.
- Onfido.

Requerimientos:

- Crear verification session desde URBNBEE.
- Redirigir o abrir flujo hospedado del proveedor.
- Recibir webhook.
- Guardar estado en `identity_verifications`.
- Asociar verificación a userId y purpose:
  - `guest_booking`
  - `host_booking_engine`
  - `host_payouts`

Estados:

- `not_started`
- `pending`
- `verified`
- `failed`
- `expired`
- `requires_review`

## 4. Pagos y suscripciones

Hay tres familias de cobro distintas.

### Guest membership

Cobro recurrente al huésped para poder reservar y dejar reviews.

Proveedor:

- Stripe Billing.

Variables:

- `STRIPE_PRICE_GUEST_VERIFICATION_MONTHLY`
- `STRIPE_PRICE_GUEST_VERIFICATION_YEARLY`

Regla:

- Guest puede reservar si `membership active` + `kyc verified`.

### Host packages

Cobro recurrente al anfitrión para activar motor de reservas por listing o por paquete.

Planes:

- Free Directory.
- Booking Starter: 1 listing.
- Booking Growth: hasta 10 listings.
- Booking Scale: 15+ o custom.

Requiere:

- Stripe products/prices.
- Entitlements por plan.
- Webhooks de subscription status.
- Aplicar límites de listings bookable.

### Booking payments

Cobro al huésped por una reserva.

Opciones:

- Stripe Connect.
- Mercado Pago marketplace.
- Pago manual con comprobante.

Principio:

URBNBEE debe evitar ser custodio informal de dinero. Idealmente el dinero va a cuenta conectada del host, y URBNBEE cobra su SaaS/add-ons por separado.

## 5. Contratos digitales

MVP:

- Generación de PDF server-side.
- Clickwrap legal:
  - usuario acepta términos.
  - timestamp.
  - IP.
  - user agent.
  - bookingId.
  - hash del documento.

Proveedor futuro:

- DocuSign.
- Dropbox Sign.
- SignWell.
- Zoho Sign.

Infra requerida:

- Template engine de contrato.
- Storage privado de PDF.
- Tabla `booking_contracts`.
- Audit events.
- Versionado de términos.

## 6. Depósitos de seguridad

MVP:

- Depósito configurado por listing.
- Cobro o autorización según proveedor.
- Ventana de reclamo 24-48 horas.
- Evidencia adjunta.
- Estado de reclamo.

Estados:

- `not_required`
- `authorized`
- `collected`
- `release_pending`
- `released`
- `claim_opened`
- `partially_charged`
- `charged`
- `refunded`
- `disputed`

Riesgo:

Si URBNBEE maneja disputas de depósitos, aumenta carga operativa y legal. Se requiere copy claro de facilitador, no árbitro total.

## 7. BeeAgent / URBNBEEAI integration

Separación correcta:

- URBNBEE.com/net: sistema de autoridad para listings, disponibilidad, reservas, pagos, contratos y reviews.
- URBNBEEAI.com: comunicación, agentes, inbox, WhatsApp/SMS/webchat y escalación humana.

Infra requerida en URBNBEE:

- API interna para que BeeAgent consulte:
  - host.
  - listings.
  - disponibilidad.
  - precios.
  - reglas.
  - amenities.
  - estado de reservas.
  - links de reserva.
- Webhook/API para que BeeAgent envíe:
  - mensajes webchat.
  - intención de reserva.
  - escalaciones.
  - conversation metadata.

Infra requerida en URBNBEEAI:

- Workspace/customer por host.
- Agent por host o por listing.
- Knowledge base sincronizada desde URBNBEE.
- Canales:
  - webchat.
  - WhatsApp.
  - SMS.
  - inbox.
- Herramientas del agente:
  - `listAvailableListings`
  - `getListingDetails`
  - `getAvailability`
  - `createBookingLead`
  - `sendBookingLink`
  - `escalateToHuman`

Seguridad:

- API tokens internos.
- Firma HMAC en webhooks.
- Scope por host/customer.
- Rate limits.
- Audit log de acciones del agente.

## 8. Reviews verificadas

Requiere:

- DB transaccional.
- Relación con booking completada.
- KYC activo del reviewer.
- Verificación de que reviewer participó en la reserva.

Reglas:

- Guest puede reseñar host/listing si:
  - booking completed.
  - guest userId coincide.
  - guest KYC verified.
- Host puede reseñar guest si:
  - booking completed.
  - host userId coincide.
  - host KYC verified o booking package activo.

## 9. Observabilidad y operación

MVP mínimo:

- Railway deploy logs.
- Stripe Dashboard.
- Cloudflare analytics.
- Admin panel interno.

Producción:

- Error tracking: Sentry.
- Structured logs.
- Webhook event table.
- Admin audit log.
- Alerts para:
  - webhook failures.
  - payment failures.
  - KYC failures.
  - booking/payment mismatch.
  - storage upload errors.

## 10. Seguridad

Necesario:

- HTTPS vía Cloudflare/Railway.
- Cookies HTTP-only, secure, SameSite.
- CSRF protection para acciones sensibles si aplica.
- Rate limits en auth, booking, messaging, uploads.
- Validación estricta de webhooks.
- Idempotency keys para pagos/webhooks.
- Separación de archivos públicos/privados.
- No guardar PII sensible de KYC.
- Política de retención de datos.
- Roles admin/host/guest.
- Audit log de cambios críticos.

## 11. Dominios y red

Actual:

- `urbnbee.net` en Cloudflare.
- Railway como origen.
- Cloudflare SSL/TLS en modo Full.

Futuro:

- `urbnbee.com` puede apuntar al mismo servicio Railway sin quitar `.net`.
- `urbnbeeai.com` permanece como SaaS separado para BeeAgent.

Recomendación:

- Elegir dominio canónico para SEO cuando se tenga `urbnbee.com`.
- Mantener `.net` como temporal o redirigir 301 a `.com`.
- Usar Cloudflare para DNS, WAF básico, cache y reglas.

## 12. Fases de infraestructura

### Fase A — MVP actual estabilizado

- Railway app.
- Cloudflare DNS/SSL.
- JSON en volumen.
- Stripe verification checkout actual.
- Mantener 1 réplica.

Objetivo: demo funcional y validación de producto.

### Fase B — DB core

- Migrar JSON a MySQL/Postgres.
- Usuarios, listings, bookings, verification, messages.
- Backups.
- Webhook event table.

Objetivo: permitir producción inicial con datos consistentes.

### Fase C — Trust layer

- Stripe Identity o proveedor KYC.
- Guest membership mensual/anual.
- Host package subscriptions.
- Badges.
- Reglas de acceso por plan.

Objetivo: monetizar confianza sin romper onboarding.

### Fase D — Booking commerce

- Stripe Connect o Mercado Pago.
- Booking payments.
- Pago manual con comprobante.
- Estados de pago.
- Contrato PDF/clickwrap.

Objetivo: reservas pagadas y documentadas.

### Fase E — Deposits and reviews

- Depósitos.
- Evidencia de daños.
- Reviews verificadas.
- Audit logs de disputas.

Objetivo: confianza post-estancia.

### Fase F — BeeAgent bridge

- API interna URBNBEE ↔ URBNBEEAI.
- Sync de listings/knowledge.
- Webchat conectado.
- WhatsApp/SMS después.

Objetivo: vender BeeAgent como add-on operativo.

## Decisión técnica inmediata

Antes de construir pagos avanzados, contratos, depósitos o BeeAgent conectado, la prioridad técnica debe ser:

1. Migrar persistencia crítica a DB.
2. Definir schema de users/listings/bookings/verification/plans.
3. Crear tabla de webhooks e idempotencia.
4. Mantener JSON solo para seeds/demo o eliminarlo.
5. Formalizar paquetes y estados.

La infraestructura actual es suficiente para validar el concepto, pero la siguiente capa de producto requiere DB, webhooks robustos y separación clara entre archivos públicos, documentos privados y KYC externo.

