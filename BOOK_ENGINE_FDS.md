# URBNBEE — Book Engine (FDS)

**Fuente:** documento *URBNBEE FDS book engine TZ AUG 1 2025* (descripción ampliada del proyecto).  
**Nota de implementación:** el entregable original describe un paquete **Node + Express + SQLite** (`booking-site.zip`). El código actual del marketplace vive en **`web/`** (Next.js 16, store JSON en desarrollo, roadmap MySQL). Este archivo es la **especificación funcional**; el stack puede adaptarse.

---

## 1. Propósito general

Crear un sitio de reservas **llave en mano** que una agencia, anfitrión o pequeña empresa pueda desplegar en minutos y reutilizar para distintos clientes cambiando **parámetros de configuración**. Objetivo: reducir barreras técnicas (sin programación adicional, sin servidores complejos ni bases externas obligatorias), manteniendo **pago profesional**, **firma de contrato** y **control de depósitos**.

---

## 2. Bloques de valor

| Qué ofrece | Beneficio |
|------------|-----------|
| **Reservas sin cuenta** | El huésped elige listing, fechas y correo; recibe **token de 6 dígitos**. Proceso rápido sin registro. |
| **Flujo Host → Huésped** | El anfitrión revisa la solicitud, puede ajustar fechas o listing y **aceptar/rechazar** antes de comprometerse. |
| **Contrato autocompletado** | Plantillas (machotes) con variables `{{nombre}}`, `{{fechas}}`, `{{listing}}`; firma digital sin trabajo manual repetido. |
| **Pagos Stripe + depósito** | Pago seguro; depósito en **modo autorización** que el host **captura o libera** al checkout. |
| **Roles claros** | **Súper-Usuario:** cupo, plantillas, QR WhatsApp, mantenimiento. **Manager/Host:** listings, precio, % depósito, reservas. **Huésped:** solo con su **token**. |
| **Paneles web** | `/admin/settings`, `/host/requests`, `/host/listings`, `/host/reservations` sin tocar archivos en servidor. |
| **Exportación CSV** | Host descarga reservas para contabilidad. |
| **Contacto** | Teléfono por listing; Súper-Usuario puede subir **QR WhatsApp** para atención. |

---

## 3. Flujo de reserva (estados)

| # | Actor | Estado | Acción en pantalla | Automático / correo |
|---|--------|--------|---------------------|---------------------|
| 1 | Huésped (sin cuenta) | — | Formulario (listing, fechas, correo, nombre) → **Solicitar** | Crea booking **PENDING**; token 6 dígitos; muestra y envía email con resumen. |
| 2 | Host / Manager | **PENDING** | Inbox: editar fechas/listing → **Aceptar** o **Rechazar** | Si acepta → **AWAITING_DETAILS**; email “aprobada” con enlace `?token=…`. |
| 3 | Huésped | **AWAITING_DETAILS** | Clic en enlace mágico **o** `/finish` + token | Valida token (ej. vigencia **72 h**); redirige a `/finish/:token`. |
| 4 | Huésped | **AWAITING_DETAILS** | Wizard paso 1: datos + ID (opcional) | Guarda en `booking_details`. |
| 5 | Huésped | **AWAITING_DETAILS** → **CONFIRMED** | Paso 2: contrato generado + firma. Paso 3: **Stripe** (cargo + retención depósito) | Machote por listing; placeholders; PDF/HTML; PaymentIntent; webhook → **CONFIRMED**; envía contrato + recibo a huésped y host. |
| 6 | Host / Manager | **CONFIRMED** → **COMPLETED** / **CANCELED** | Detalle: **capturar** o **liberar** depósito | `stripe.capture` / `stripe.cancel`; estado final e informes. |

---

## 4. Roles y accesos (resumen)

| Rol | Audiencia | Permisos clave | Límites |
|-----|-----------|----------------|---------|
| **Súper-Usuario** | Dueño plataforma | Mantenimiento global, cupo listings (0–100), **plantillas de contrato**, alta/baja **Managers**, Stripe/SMTP/dominio, logs. | Acceso total configuración. |
| **Manager / Host** | Operador | CRUD listings dentro del cupo, publicar/ocultar, machotes asignados (hasta **5** precargados), aceptar/rechazar solicitudes, ver ID/contrato, capturar/liberar depósito, **CSV**. | No supera cupo global; solo plantillas dadas de alta por Súper-Usuario; no ve otros hosts. |
| **Huésped** | Visitante | Solicitar, token, consultar estado, completar datos, firmar, pagar; solo su reserva vía **token**. | Sin panel admin. |

---

## 5. Páginas y rutas sugeridas (FDS)

| Ruta | Público / rol | Contenido principal |
|------|----------------|----------------------|
| `/` | Público | Grid de listings; combo **“Ingresa tu código”** → lookup token (`/api/booking/lookup`). |
| `/listing/:id` | Público | Galería, descripción, teléfono host; fechas + email → **Solicitar** → token. |
| `/finish/:token` | Huésped con token | Wizard 3 pasos si estado = **AWAITING_DETAILS** (datos/ID, contrato+firma, pago Stripe). |
| `/host/requests` | Host | Bandeja **PENDING**; editar; aceptar/rechazar. |
| `/host/listings` | Host | CRUD listings; precio; % depósito; moneda; machote; publicar; teléfono por listing. |
| `/host/reservations` | Host | Todas las reservas + filtros + **Exportar CSV**. |
| `/host/profile` | Host | Teléfono global, foto, bio. |
| `/admin/settings` | Súper-Usuario | Mantenimiento, cupo, managers, machotes, Stripe/SMTP, dominio, QR WhatsApp, logs. |
| `/info` | Público | Quiénes somos; contacto; QR WhatsApp según config. |

---

## 6. Entregables originales (paquete ZIP)

| Elemento | Uso |
|----------|-----|
| `booking-site.zip` | Paquete para hosting: `dist/` front estático, `server.js` Express, `/data/` vacío (nace **SQLite** ahí), `.env.example`, `package.json`. |

### Variables `.env` mínimas (ejemplo FDS)

```
PORT=3000
STRIPE_SECRET_KEY=sk_live_xxx
SENDGRID_API_KEY=SG_xxx
SUPER_ADMIN_EMAIL=admin@cliente.com
SUPER_ADMIN_PASSWORD=ContraseñaInicial
MAX_LISTINGS=100
JWT_SECRET=AlgoMuySecreto
```

### Instalación resumida (3 pasos)

1. Subir ZIP al hosting y descomprimir.  
2. Copiar `.env.example` → `.env` y completar variables.  
3. `npm install` + `npm start` → crea `data/db.sqlite`, usuario Súper-Usuario, muestra URL y credenciales.

*(En el repo Next.js actual, el equivalente es configurar `.env.local`, MySQL cuando exista, y secretos Stripe/SMTP cuando se integre el motor de reservas.)*

---

## 7. Alineación con el repo `web/` (Urbnbee Airbnbe)

| FDS | Implementación actual (referencia) |
|-----|-------------------------------------|
| Listings públicos + detalle | ✅ Browse + `/listings/[slug]` |
| Host CRUD listings / calendario / perfil | ✅ `/host/listings`, `/host/calendar`, perfil en editor |
| Mensajería huésped ↔ host | ✅ Bandeja `/host/messages` + API (sin sustituir flujo reserva) |
| Token 6 dígitos + estados PENDING… | Pendiente (motor reservas) |
| Stripe + depósito autorizado | Pendiente |
| Contratos machotes + firma | Pendiente |
| Súper-Usuario `/admin/settings` | Pendiente (solo host/guest en store demo) |
| SQLite Express zip | Sustituido por Next.js + JSON → roadmap MySQL en `SYSTEM_ARCHITECTURE_AND_ROADMAP.md` |

---

*Documento integrado en el repositorio para que agentes y desarrolladores compartan una única fuente funcional con el FDS original.*
