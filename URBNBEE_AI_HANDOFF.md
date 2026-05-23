# Urbnbee — handoff para agentes / otra IA

Documento de contexto para continuar desarrollo, deploy o soporte sin releer todo el repo. Actualizado a mayo 2026.

---

## 1. Qué es el producto

**Urbnbee** es un marketplace de alojamientos (rentas cortas / estancias) orientado al mercado **informal** en México y expansión US: más confianza que Facebook Marketplace o grupos de WhatsApp, menos control y comisión que Airbnb.

**Tesis:** publicar y rentar de forma directa, con capas opcionales de confianza:

- Identidad verificada (huésped y, en roadmap, anfitrión)
- Reservas documentadas en la plataforma
- Pagos guiados (Stripe; Connect en roadmap)
- Reviews verificadas (parcial / roadmap)
- Asistencia opcional vía **BeeAgent** (producto hermano en urbnbeeai.com)

Urbnbee **no** aspira a ser árbitro total de disputas; facilita trazabilidad y herramientas; la relación principal sigue siendo anfitrión ↔ huésped.

**Dominios:**

- Producción actual: `www.urbnbee.net` / `urbnbee.net` (Railway + Cloudflare)
- Futuro: `urbnbee.com` (mismo stack; cambiar webhook Stripe y DNS cuando migren)
- BeeAgent / partner API: `urbnbeeai.com` (otro backend; webhooks Stripe separados)

**Repo GitHub:** `TonnyDiablo-sudo/Urbnbee-Rentals` (rama `main`).

---

## 2. Objetivo de negocio (modelo de producto)

| Capa | Estado | Descripción |
|------|--------|-------------|
| **Directorio gratis** | Parcial | Publicar listings, perfil host, contacto; badge “no verificado” si no hay paquete |
| **Motor de reservas (host)** | MVP | Calendario, solicitudes, aceptar/rechazar; paquetes por tier en roadmap |
| **Membresía huésped** | Implementado | Suscripción Stripe (mensual/anual) + opcional KYC Stripe Identity |
| **Pago de estancia** | Parcial | Checkout por reserva; simulación si no hay Stripe |
| **Contrato digital** | Roadmap | — |
| **BeeAgent** | API partner | Integración server-to-server para leads/listings desde urbnbeeai.com |

**Pricing membresía huésped (Stripe, productos reales):**

- MX: ~$99/mes, ~$850/año
- US: ~$6/mes, ~$60/año  
Variables regionales en Railway (ver §6).

**Regla actual para reservar:** si hay precios de verificación configurados, el huésped necesita **membresía activa** (`active` o `trialing`). Si `STRIPE_IDENTITY_ENABLED=true`, además **KYC `verified`**.

---

## 3. Arquitectura técnica

### Stack

- **App:** Next.js 16 (App Router), React 19, TypeScript, Tailwind 4
- **Runtime:** Node ≥ 20
- **Carpeta de aplicación:** `web/` (monorepo: raíz del repo tiene `nixpacks.toml` + `railway.json` por si Railway usa root `/`; idealmente **Root Directory = `web`** en Railway)
- **Auth:** cookie HTTP-only `urb_session`, HMAC con `SESSION_SECRET`, bcrypt en passwords
- **Pagos / identidad:** Stripe (Checkout suscripción, Identity VerificationSession, webhooks)
- **DB opcional:** MySQL (`DATABASE_URL`); migración en arranque vía `scripts/start.mjs` → `db:migrate`
- **Persistencia principal hoy:** JSON en volumen Railway (`URBNBEE_DATA_DIR`, `URBNBEE_UPLOADS_DIR`)

### Deploy (Railway)

- Proyecto: **superb-learning**, servicio **Urbnbee Rentals**
- CI: push a `main` en GitHub dispara deploy
- Build: Nixpacks, `npm run build` en `web/`
- Start: `npm run start` → `web/scripts/start.mjs` (seed JSON, migrate MySQL si hay URL, luego `next start`)
- Healthcheck: `/`
- **1 réplica** recomendada mientras persista en JSON (sin transacciones ni locks fuertes)

Raíz del repo incluye `nixpacks.toml` con `NIXPACKS_NODE_VERSION=20` y fases `cd web && npm ci/build` por si el servicio apunta a `/` en lugar de `web/`.

### Persistencia (archivos en volumen)

| Archivo | Contenido |
|---------|-----------|
| `marketplace-store.json` | Usuarios, perfiles host, listings |
| `bookings.json` | Reservas y estados |
| `guest-verification.json` | Suscripción Stripe + estado KYC por userId |
| `host-inbox-messages.json` | Mensajes guest/host |
| `blog-published-posts.json` | Posts publicados |
| `blog-bot-config.json` | Config del generador de blog (admin) |

**Regla:** siempre usar `getDataDir()` / `getUploadsDir()` de `web/lib/runtime-paths.ts`; no hardcodear `cwd/data`.

Uploads públicos: `/uploads/[...path]` sirve desde el volumen.

### Roles

| Rol | Acceso |
|-----|--------|
| `guest` | `/guest/*` — reservas, mensajes, membresía |
| `host` | `/host/*` — listings, calendario, solicitudes, inbox |
| `admin` | `/admin/*` — usuarios, reservas, logs, blog bot; también puede usar panel host |

Admin no se crea desde la UI de registro. Opciones:

- Variable `URBNBEE_ADMIN_EMAIL` + script `bootstrap-admin.mjs` al arranque
- POST `/api/auth/claim-admin` o página `/claim-admin` (misma variable, usuario logueado)

---

## 4. Mapa del código (`web/`)

```
web/
├── app/
│   ├── page.tsx, /membresia, /login, /register, /blog, /listings/[slug]
│   ├── guest/          # cuenta huésped, membresía, reservas
│   ├── host/           # panel anfitrión
│   ├── admin/          # panel administración del sitio
│   ├── api/
│   │   ├── auth/       # login, register, session, claim-admin
│   │   ├── verification/  # checkout, status, identity/start, billing-portal
│   │   ├── webhooks/stripe/
│   │   ├── bookings/   # request, checkout, finish, lookup
│   │   ├── host/, guest/, admin/
│   │   └── integrations/beeagent/v1/  # partner API
│   └── uploads/[...path]/route.ts
├── lib/
│   ├── marketplace-store.ts   # usuarios, listings (JSON)
│   ├── bookings-store.ts
│   ├── verification-store.ts  # membresía + KYC + price IDs regionales
│   ├── verification-region.ts # geo MX/US (CF-IPCountry, etc.)
│   ├── stripe-server.ts
│   ├── session.ts
│   └── runtime-paths.ts
├── scripts/start.mjs, bootstrap-admin.mjs, db-migrate.mjs
├── sql/001_schema.sql         # MySQL (futuro / opcional)
├── railway.json               # healthcheck, start command
└── .env.example
```

Documentación extendida en repo:

- `URBNBEE_TRUST_MARKETPLACE_BRIEF.md` — estrategia y producto
- `URBNBEE_INFRASTRUCTURE_BRIEF.md` — infra y requisitos
- `DEPLOY_RAILWAY.md` — deploy paso a paso

---

## 5. Flujos críticos implementados

### Membresía huésped

1. Usuario logueado → `/guest/membresia`
2. POST `/api/verification/checkout` con `plan` (`monthly`|`annual`) y `region` (`mx`|`us`)
3. Redirect a Stripe Checkout (mode `subscription`)
4. Webhook `checkout.session.completed` / `customer.subscription.*` → `verification-store`
5. GET `/api/verification/status` para UI

Precios: `resolveVerificationPriceId()` en `verification-store.ts` — modo regional si hay algún `STRIPE_PRICE_VERIFICATION_MX_*` o `US_*`; si no, legado `STRIPE_PRICE_VERIFICATION_MONTHLY/ANNUAL`.

### Identidad (KYC)

- Requiere `STRIPE_IDENTITY_ENABLED=true`
- Requiere membresía activa antes de iniciar
- POST `/api/verification/identity/start` → Stripe Identity `document` + selfie
- Webhooks `identity.verification_session.*` → actualiza `kycStatus`

### Reserva

- POST `/api/bookings/request` — gate: `isGuestEligibleToBook(userId)`
- Host gestiona en `/host/requests`
- Pago estancia: `/api/bookings/[id]/checkout` (Stripe) o simulate si no hay key

### Stripe webhook

- URL producción: `https://www.urbnbee.net/api/webhooks/stripe`
- Eventos mínimos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, y eventos `identity.verification_session.*` si Identity activo
- **Mismo modo** (test/live) para `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y todos los `price_…`

### BeeAgent (partner)

- Rutas bajo `/api/integrations/beeagent/v1/*`
- Auth: `Authorization: Bearer` con `URBNBEE_PARTNER_API_SECRET`
- CORS: `URBNBEE_PARTNER_ORIGINS` (default urbnbeeai.com)
- Webhooks firmados opcionales con `URBNBEE_PARTNER_WEBHOOK_SECRET`

---

## 6. Variables de entorno (producción Railway)

**Obligatorias / core:**

- `SESSION_SECRET`
- `URBNBEE_DATA_DIR` (ej. `/data/json`)
- `URBNBEE_UPLOADS_DIR` (ej. `/data/uploads`)
- `NODE_ENV=production`

**Stripe membresía + KYC:**

- `STRIPE_SECRET_KEY` (`sk_live_…` o `sk_test_…`)
- `STRIPE_WEBHOOK_SECRET` (`whsec_…` del endpoint urbnbee.net)
- `STRIPE_PRICE_VERIFICATION_MX_MONTHLY`, `_MX_ANNUAL`, `_US_MONTHLY`, `_US_ANNUAL`
- `STRIPE_IDENTITY_ENABLED` (`true` para exigir KYC además de suscripción)

**Admin bootstrap:**

- `URBNBEE_ADMIN_EMAIL` — promueve ese correo a `admin` al arranque o vía `/claim-admin`

**Opcionales:**

- `DATABASE_URL` — MySQL plugin Railway
- `URBNBEE_PARTNER_API_SECRET`, `URBNBEE_PARTNER_WEBHOOK_SECRET`, `URBNBEE_PARTNER_ORIGINS`
- `OPENAI_API_KEY` / `BLOG_BOT_OPENAI_API_KEY`, `CRON_SECRET`
- `PLATFORM_BOOKING_FEE_PERCENT`, `PLATFORM_BOOKING_FEE_MIN_MXN`

Ver plantilla completa: `web/.env.example`.

---

## 7. Estado actual (qué funciona y qué no)

### Funciona / en producción

- Sitio público, browse, detalle listing, registro/login
- Panel host (listings, mensajes, reservas básicas)
- Panel admin (overview, usuarios, reservas, logs, blog bot UI)
- Deploy GitHub → Railway con Node 20 y deps de build en `dependencies` (tailwind/typescript para Nixpacks production)
- Membresía: flujo código completo; **requiere Stripe bien configurado** (mismo modo live/test en key, prices, webhook)
- Stripe Identity: código + webhooks; requiere Identity activado en cuenta Stripe
- Integración BeeAgent API (endpoints presentes)
- Volumen para JSON y uploads entre deploys

### Frágil / en progreso

- **Checkout membresía 502:** casi siempre mezcla `sk_live` con `price_` de test, customer Stripe de test guardado en `guest-verification.json`, o price ID incorrecto para región US/MX
- Persistencia JSON: no escalar a múltiples réplicas; riesgo concurrencia
- MySQL: schema existe; app sigue leyendo/escribiendo JSON como fuente de verdad
- Sin recuperación de contraseña por email
- Sin Stripe Connect para pagos al host
- Dominio custom en Stripe Checkout (branding sí; dominio propio opcional)
- Bloque “código de reserva” en home **eliminado**; `/finish/[token]` y APIs de booking token siguen para flujos logueados

### Roadmap (no implementar sin pedirlo)

- Migrar stores a MySQL
- Paquetes host (Starter/Growth/Scale) con Stripe
- Contratos PDF, reviews verificadas end-to-end
- Storage fotos en S3/Cloudinary
- `urbnbee.com` como dominio principal

---

## 8. Convenciones para cambios de código

- App vive en **`web/`**; commits a `main` despliegan solos
- No commitear secretos ni `marketplace-store.json` con datos reales (gitignore)
- Stripe: nunca loguear `sk_` ni `whsec_` en chat o commits
- Nuevos datos en disco → `runtime-paths.ts`
- Membresía/regional → `verification-store.ts`, `verification-region.ts`, `verification-types.ts`
- UI membresía → `app/guest/membresia/`, landing pública `app/membresia/`
- Admin layout sin header público; logout en sidebar (`AdminLogoutButton`)

---

## 9. Comandos útiles

```bash
cd web
npm run dev          # puerto 3005
npm run build
npm run start        # producción local (start.mjs)

# Raíz repo — push despliega Railway
git push origin main
```

Railway: servicio **Urbnbee Rentals**, root **`web`**, variables en pestaña Variables, logs en Deployments.

---

## 10. Checklist rápido para otra IA

Antes de tocar Stripe o deploy, confirmar:

1. ¿Modo **test** o **live** en Dashboard Stripe?
2. ¿`STRIPE_SECRET_KEY`, los 4 `price_…` y `STRIPE_WEBHOOK_SECRET` son del **mismo modo y cuenta**?
3. ¿Webhook apunta a `https://www.urbnbee.net/api/webhooks/stripe` (no urbnbeeai.com)?
4. ¿Deploy Railway **ACTIVE** y último commit en `main`?
5. ¿Usuario de prueba es **guest** (no solo host) para `/guest/membresia`?
6. ¿Admin vía `URBNBEE_ADMIN_EMAIL` + `/claim-admin` si hace falta panel `/admin`?

Si el usuario pide “conectar Stripe” o “arreglar membresía”, empezar por logs de `/api/verification/checkout` y respuesta JSON del error (mensaje de Stripe), no por cambios de UI.

---

*Este archivo es contexto operativo; la visión de producto detallada está en `URBNBEE_TRUST_MARKETPLACE_BRIEF.md` y la infra en `URBNBEE_INFRASTRUCTURE_BRIEF.md`.*
