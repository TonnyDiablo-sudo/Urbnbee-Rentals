# URBNBEE — Arquitectura del Sistema + Hoja de Ruta del Marketplace

> **Para AI:** Este documento describe lo que ya está construido (`beeagent-ui`) y el plan para construir el nuevo marketplace (`urbnbee.com`). Léelo completo antes de tocar código.

---

## PARTE 1 — Lo que ya existe: `beeagent-ui`

### Visión General

`beeagent-ui` es una **SaaS multi-tenant B2B**: pequeñas empresas de servicios (spas, salones, clínicas) obtienen un agente de IA que responde SMS/WhatsApp en su nombre y agenda citas automáticamente.

```
Cliente final (SMS/WhatsApp)
        ↓
   Telnyx / Meta
        ↓
   n8n (inbound signal) ──→ /api/internal/worker/process-message
                                        ↓
                          ┌─────────────────────────────┐
                          │    AI WORKER PIPELINE        │
                          │  1. Claim message (MySQL)    │
                          │  2. Debounce check (6s)      │
                          │  3. Load tenant context      │
                          │  4. Parallel LLMs:           │
                          │     - Concierge (GPT-4o-mini)│
                          │     - Calendar intent        │
                          │     - Date extractor         │
                          │  5. Calendar chain (if need) │
                          │  6. Booking flow advance     │
                          │  7. Send SMS via Telnyx      │
                          │  8. Log to worker_executions │
                          └─────────────────────────────┘
                                        ↓
                                    MySQL DB
```

---

### Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend/Backend | Next.js 16 (App Router), React 19 |
| Base de datos | MySQL (Railway) |
| Hosting | Railway (Next.js app + MySQL) |
| Mensajería SMS | Telnyx REST API |
| Mensajería WhatsApp | Meta Cloud API |
| IA | OpenAI GPT-4o-mini |
| Orquestación legacy | n8n (self-hosted) — parcialmente migrado al backend |
| Pagos | Stripe (suscripciones + webhooks) |
| Email | Nodemailer |
| Auth | Cookie HTTP-only (`session_user` = `users.id`) |

---

### Modelo Multi-Tenant

```
customers (workspace/tenant)
    ├── users (login; role: user | admin | manager | viewer | seller)
    ├── customer_agents (agente IA; 1 o más por tenant; tiene DID de Telnyx)
    │       ├── tenant_phone_numbers (DID asignado)
    │       └── knowledge / manual_text / business_prompt
    ├── customer_services (catálogo de servicios agendables)
    ├── appointments (citas creadas)
    ├── messages (SMS/WA inbound+outbound; queue para el worker)
    ├── conversation_booking_state (estado del booking wizard por conversación)
    ├── conversation_ai_settings (AI on/off por conversación)
    ├── usage_events (metering para billing)
    └── subscription_status (plan Stripe activo)
```

**Clave de conversación:** `telnyx:{DID_NEGOCIO}:{PHONE_CLIENTE}` — identifica un hilo entre un negocio y un cliente. El worker la usa para aislar tenant y contexto.

---

### Pipeline del Worker (detalle)

1. **Claim**: `UPDATE messages SET claimed_by=? WHERE status='received' AND conversation_key=? AND id=?` — garantiza que solo un proceso maneja cada mensaje.
2. **Debounce (6s)**: Si llegan mensajes en ráfaga del mismo cliente, los anteriores se marcan `tombstoned` (procesados sin responder). Solo responde al último.
3. **Contexto**: Carga `customer`, `customer_agents`, historial de conversación, servicios, estado de booking, y el system prompt.
4. **LLMs en paralelo**:
   - **Concierge LLM**: genera la respuesta conversacional (responde preguntas, tono del negocio).
   - **Calendar Intent Classifier**: determina si el mensaje pide disponibilidad o una cita específica (TRUE/FALSE). **NO** dispara para preguntas de info del negocio (horarios en general, días laborales — esas las responde el concierge desde el prompt).
   - **Date/Time Extractor**: micro-LLM estructurado que extrae `{ymd, time_minutes}` del mensaje.
5. **Calendar Chain** (si intent=true O extractor encontró fecha/hora O hay booking activo):
   - Consulta `/api/calendar/slots` con la fecha/hora extraída.
   - **Calendar LLM** decide el `booking_command` (intent: propose | confirm | none, etc.).
   - Reglas: nunca auto-llenar servicio sin que el cliente lo especifique; nunca usar `guest_line_digits` como teléfono del cliente; pedir nombre+teléfono+fecha+hora en un solo mensaje.
6. **Booking Flow**: `/api/internal/booking-flow/step` avanza el estado (idle → proposing → awaiting_confirm → confirmed → idle).
7. **Respuesta**: Telnyx SMS con la respuesta del concierge (o del calendar). Metering a `usage_events`.
8. **Log**: `worker_executions` con todos los eventos, tokens usados y costos. Visible en `/admin/logs`.

---

### Páginas Admin Clave

| Ruta | Función |
|------|---------|
| `/admin/logs` | Trazas del worker: tokens, costo LLM + SMS, timeline de eventos por ejecución |
| `/admin/customers` | Gestión de tenants, planes, estado de suscripción |
| `/admin/billing` | Overview de facturación plataforma |
| `/admin/executive-overview` | KPIs generales |
| `/inbox` | Bandeja de mensajes de todos los tenants (staff) |

---

### Qué ya funciona bien

- ✅ Multi-tenant aislado (messaging, calendar, billing)
- ✅ Worker AI con debounce, tombstone y logs
- ✅ Booking flow completo (propuesta → confirmación → cita creada)
- ✅ Extracción de fecha/hora robusta multi-idioma (vía LLM)
- ✅ Intent classifier para separar preguntas de info vs. requests de cita
- ✅ Admin logs con tokens + costos por ejecución
- ✅ Stripe suscripciones + webhooks
- ✅ Telnyx DID auto-asignación por tenant
- ✅ WhatsApp Meta (webhook + envío)
- ✅ Auth con roles (admin/manager/viewer/user/seller)

### Qué está pendiente / incompleto

- ⏳ WhatsApp: UI de setup y flujo completo de onboarding
- ⏳ Deduplicación de slots concurrentes (dos clientes piden el mismo horario)
- ⏳ Phone self-service para el tenant
- ⏳ Costo de tokens en tabla `messages`

---

## PARTE 2 — El nuevo proyecto: `urbnbee.com` Marketplace

### Concepto

**urbnbee.com** actualmente es un directorio de hospedaje con frontend decente pero backend incompleto. El objetivo es **reconstruirlo como un marketplace multi-tenant tipo Airbnb**, manteniendo el estilo visual, empezando por propiedades y expandiendo a servicios (talleres, experiences, etc.).

**Diferencia clave vs. beeagent-ui:**
- `beeagent-ui` = SaaS B2B (el negocio es el tenant, el cliente es el end-user vía SMS).
- `marketplace` = Plataforma B2C directa (anfitrión publica, huésped reserva en la web).

### Especificación Book Engine (FDS)

La descripción funcional del **motor de reservas plug-and-play** del documento Word *URBNBEE FDS book engine* (token de 6 dígitos, estados `PENDING` → `AWAITING_DETAILS` → `CONFIRMED`, Stripe con depósito en autorización, roles Súper-Usuario / Host / Huésped, rutas `/finish/:token`, `/host/requests`, entrega tipo `booking-site.zip` + SQLite en el original) está consolidada en **[BOOK_ENGINE_FDS.md](./BOOK_ENGINE_FDS.md)**. Sirve como contrato de referencia al implementar pagos y workflow de reserva sobre el código actual en `web/`.

---

### Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────┐
│                    MARKETPLACE FRONTEND                   │
│  (Next.js App Router — mismo stack que beeagent-ui)      │
│                                                           │
│  /                    → Landing (browse listings)         │
│  /listings/[slug]     → Detalle propiedad                 │
│  /search              → Búsqueda + filtros                │
│  /host/dashboard      → Panel del anfitrión               │
│  /host/listings       → CRUD de propiedades               │
│  /host/calendar       → Calendario de disponibilidad      │
│  /host/reservations   → Gestión de reservas               │
│  /guest/trips         → Reservas del huésped              │
│  /guest/profile       → Perfil                            │
│  /admin/*             → Panel admin plataforma            │
└─────────────────────────────────────────────────────────┘
                          ↕ API Routes
┌─────────────────────────────────────────────────────────┐
│                    BACKEND (Next.js API)                  │
│                                                           │
│  /api/listings/         CRUD + búsqueda + filtros         │
│  /api/listings/[id]/availability   Disponibilidad         │
│  /api/bookings/         Crear/gestionar reservas          │
│  /api/payments/         Stripe (checkout + payout)        │
│  /api/reviews/          Reseñas bidireccionales           │
│  /api/messages/         Mensajería interna                │
│  /api/host/             Dashboard del anfitrión           │
│  /api/admin/            Gestión plataforma                │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│                    BASE DE DATOS (MySQL)                  │
│                                                           │
│  users          (huéspedes + anfitriones; roles)          │
│  listings       (propiedades/experiences)                  │
│  listing_photos (imágenes por listing)                    │
│  listing_availability  (calendario del anfitrión)        │
│  bookings       (reservas; estado: pending→confirmed→..) │
│  reviews        (host↔guest bidireccional)                │
│  payouts        (liquidaciones a anfitriones)             │
│  platform_fees  (fees por transacción)                    │
│  messages       (chat interno huésped↔anfitrión)          │
└─────────────────────────────────────────────────────────┘
```

---

### Plan de Fases (bottom-up)

#### Fase 0 — Base (DB + Auth)
- Esquema MySQL: `users`, `listings`, `listing_photos`, `listing_availability`, `bookings`, `reviews`.
- Auth idéntico a `beeagent-ui`: cookie HTTP-only, bcrypt, roles (`guest` | `host` | `admin`).
- Registro con selector de rol (solo quiero reservar / quiero publicar).
- **Reusar de beeagent-ui:** `src/lib/password-verify.ts`, `src/middleware.ts` (adaptar paths), patrón de `session_user` cookie, `staff-roles.ts` → adaptar a `host`/`guest`.

#### Fase 1 — Landscaping (Browse listings)
- Página `/` con grid de listings (cards con foto, precio, rating, categoría).
- Página `/listings/[slug]` con galería, descripción, amenities, mapa, precio.
- Búsqueda básica: location, fechas, número de huéspedes.
- Filtros: categoría (casa, departamento, cabaña...), precio, rating.
- **Sin login requerido para browsear** (igual que Airbnb/urbnbee actual).
- **Reusar de beeagent-ui:** componentes UI (Tailwind dark/light), patrón de `page.tsx` server components con fetch a MySQL.

#### Fase 2 — Host onboarding + CRUD listings
- `/host/listings/new` — wizard multi-step:
  1. Tipo de espacio (casa, habitación, departamento, cabaña, experience...)
  2. Ubicación + mapa
  3. Fotos (upload a S3/Cloudinary)
  4. Descripción + amenities
  5. Precio por noche + limpieza
  6. Disponibilidad (calendario)
- Dashboard del anfitrión: métricas, reservas pendientes, ingresos.
- **Reusar de beeagent-ui:** patrón de wizard (ver `booking-flow-step.ts` lógica de estado), `calendar-availability.ts` para días bloqueados, patrón de API routes con `customer_id` → adaptar a `host_id`.

#### Fase 3 — Booking flow (huésped)
- Check de disponibilidad en tiempo real al seleccionar fechas.
- Resumen de reserva: fechas, precio noche × noches + fee limpieza + fee plataforma.
- Pago vía Stripe Checkout (hold → captura al confirmar host, o instant book).
- Estados: `pending_payment` → `confirmed` → `checked_in` → `completed` | `cancelled`.
- Cancelaciones con política (flexible/moderada/estricta) → reembolso parcial vía Stripe.
- **Reusar de beeagent-ui:** toda la infra de Stripe (`stripe-platform.ts`, webhooks, `workspace-subscription.ts` como patrón); adaptarla para pagos de reserva en lugar de suscripciones.

#### Fase 4 — Reviews + Messaging
- Reseñas bidireccionales post-checkout (host reseña guest, guest reseña listing+host).
- Sistema de mensajería interna (hilo por reserva; similar a `messages` table de beeagent-ui).
- **Opcional:** conectar el AI concierge de `beeagent-ui` para que el host tenga un AI respondiendo preguntas de los huéspedes — esto es donde los dos proyectos se fusionan.

#### Fase 5 — AI Concierge integración
- Cada listing puede tener un agente IA (reusar el worker de `beeagent-ui` completo).
- El huésped escribe por WhatsApp/SMS y el AI responde preguntas del listing y puede crear una reserva.
- El anfitrión ve todo en la misma bandeja de `beeagent-ui`.
- **REUTILIZAR COMPLETO:** todo `src/lib/worker/`, `booking-flow-*.ts`, `calendar-chain.ts`, `execution-log.ts`.

---

### Qué Reutilizar de beeagent-ui (checklist para el AI)

| Módulo | Reutilizable como está | Adaptación necesaria |
|--------|----------------------|---------------------|
| `src/middleware.ts` | ✅ | Cambiar paths protegidos |
| `src/app/api/auth/*` | ✅ | Agregar rol `host`/`guest` en signup |
| `src/lib/staff-roles.ts` | ✅ | Extender con `host`, `guest` |
| `src/lib/db.ts` | ✅ | Sin cambio |
| `src/lib/stripe-platform.ts` | ✅ | Adaptar flows a pagos por reserva |
| `src/lib/worker/*` | ✅ (Fase 5) | Conectar a listings en lugar de `customer_agents` |
| `src/lib/calendar-availability.ts` | ✅ | Reusar para disponibilidad de listings |
| `src/lib/booking-flow-*.ts` | Parcial | Adaptar estados a reservas de hospedaje |
| `src/components/*` | ✅ | Reusar design system (Tailwind) |
| `src/app/(app)/admin/*` | ✅ | Panel admin de plataforma |
| `src/lib/plan-entitlements.ts` | Opcional | Si los hosts tienen planes de suscripción |
| `src/lib/telnyx-client.ts` | ✅ (Fase 5) | Para notificaciones SMS a host/guest |

---

### Esquema DB Inicial (Fase 0–1)

```sql
-- Usuarios (hosts y guests)
CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url VARCHAR(512),
  role ENUM('guest','host','admin') NOT NULL DEFAULT 'guest',
  is_host TINYINT(1) DEFAULT 0,           -- puede ser guest Y host
  stripe_account_id VARCHAR(100),          -- Stripe Connect para payouts
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Listings
CREATE TABLE listings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  host_id INT UNSIGNED NOT NULL REFERENCES users(id),
  slug VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category ENUM('room','house','apartment','cabin','vineyard','experience','other') NOT NULL,
  space_type ENUM('entire_place','private_room','shared_room') DEFAULT 'entire_place',
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  max_guests TINYINT UNSIGNED DEFAULT 2,
  bedrooms TINYINT UNSIGNED DEFAULT 1,
  bathrooms TINYINT UNSIGNED DEFAULT 1,
  price_per_night DECIMAL(10,2) NOT NULL,
  cleaning_fee DECIMAL(10,2) DEFAULT 0,
  platform_fee_pct DECIMAL(5,2) DEFAULT 10.00,
  cancellation_policy ENUM('flexible','moderate','strict') DEFAULT 'moderate',
  is_active TINYINT(1) DEFAULT 1,
  is_verified TINYINT(1) DEFAULT 0,
  rating_avg DECIMAL(3,2) DEFAULT NULL,
  review_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_host(host_id), INDEX idx_city(city), INDEX idx_category(category)
);

-- Fotos del listing
CREATE TABLE listing_photos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  listing_id INT UNSIGNED NOT NULL REFERENCES listings(id),
  url VARCHAR(512) NOT NULL,
  sort_order TINYINT DEFAULT 0,
  is_cover TINYINT(1) DEFAULT 0
);

-- Amenities
CREATE TABLE listing_amenities (
  listing_id INT UNSIGNED NOT NULL,
  amenity VARCHAR(100) NOT NULL,
  PRIMARY KEY (listing_id, amenity)
);

-- Disponibilidad del anfitrión
CREATE TABLE listing_availability (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  listing_id INT UNSIGNED NOT NULL REFERENCES listings(id),
  date DATE NOT NULL,
  is_blocked TINYINT(1) DEFAULT 0,    -- bloqueado manualmente
  min_nights TINYINT DEFAULT 1,
  UNIQUE KEY uq_listing_date (listing_id, date)
);

-- Reservas
CREATE TABLE bookings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  listing_id INT UNSIGNED NOT NULL REFERENCES listings(id),
  guest_id INT UNSIGNED NOT NULL REFERENCES users(id),
  host_id INT UNSIGNED NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  num_guests TINYINT UNSIGNED NOT NULL,
  nights TINYINT UNSIGNED NOT NULL,
  price_per_night DECIMAL(10,2) NOT NULL,
  cleaning_fee DECIMAL(10,2) DEFAULT 0,
  platform_fee DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending_payment','confirmed','cancelled','checked_in','completed') DEFAULT 'pending_payment',
  stripe_payment_intent_id VARCHAR(255),
  cancelled_at TIMESTAMP NULL,
  cancel_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_listing(listing_id), INDEX idx_guest(guest_id), INDEX idx_host(host_id)
);

-- Reseñas
CREATE TABLE reviews (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id INT UNSIGNED NOT NULL REFERENCES bookings(id),
  reviewer_id INT UNSIGNED NOT NULL,
  reviewee_id INT UNSIGNED NOT NULL,
  listing_id INT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  type ENUM('guest_to_host','host_to_guest') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### Variables de Entorno Necesarias

```env
# DB (igual que beeagent-ui)
DB_HOST=
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=urbnbee_marketplace

# Auth
SESSION_SECRET=                    # Para firmar cookies

# Stripe (Stripe Connect para pagos entre guests y hosts)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CONNECT_CLIENT_ID=          # Para onboarding de anfitriones

# Storage (fotos)
CLOUDINARY_URL=                    # O AWS S3 vars

# IA (Fase 5)
OPENAI_API_KEY=
INTERNAL_API_TOKEN=

# SMS (Fase 5)
TELNYX_API_KEY=
```

---

### Decisiones de Arquitectura Importantes

1. **Stripe Connect** (no normal Stripe): los pagos van del huésped → Stripe → anfitrión (con fee de plataforma). Stripe Connect maneja los payouts automáticos. `beeagent-ui` ya tiene Stripe integrado; el patrón es el mismo pero con `application_fee_amount` en el PaymentIntent.

2. **Instant Book vs. Request**: empezar con Request (host confirma en 24h) — es más simple y da tiempo para validar fechas. Instant Book se puede agregar después con un flag por listing.

3. **Fotos**: usar Cloudinary (tiene tier gratuito generoso, transformaciones on-the-fly para thumbnails). Evitar subir al repo o al servidor.

4. **Búsqueda**: Para Fase 1, un `SELECT` con `WHERE city LIKE ?` es suficiente. En Fase 3+ considerar Algolia o MySQL Full-Text para búsqueda semántica.

5. **Multi-tenant en el marketplace**: el "tenant" aquí es el **anfitrión** (host). Cada host tiene sus listings, calendario, configuración de precios. La plataforma (URBNBEE) es el super-admin. Esto es exactamente como `customers` en `beeagent-ui`.

6. **Un usuario puede ser guest Y host**: el campo `is_host` en `users` + el rol `host` permiten esto. Un mismo login puede reservar Y publicar (como en Airbnb real).

---

### Primer Paso Recomendado

```
1. Crear repo nuevo (o branch separado): `urbnbee-marketplace`
2. Inicializar Next.js 15 App Router con Tailwind + TypeScript
   → Copiar design tokens / colores del sitio actual
3. Aplicar schema SQL (Fase 0–1 arriba)
4. Copiar de beeagent-ui:
   - src/lib/db.ts
   - src/app/api/auth/* (adaptar roles)
   - src/middleware.ts (adaptar paths)
   - Componentes UI básicos
5. Construir la landing page con listings hardcodeados (seed data)
6. Iterar
```

---

*Documento generado el 2026-05-08. Mantener actualizado a medida que el proyecto evoluciona.*
