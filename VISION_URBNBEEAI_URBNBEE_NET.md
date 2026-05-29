# Visión unificada: urbnbeeai.com ↔ urbnbee.net

**Para:** producto, BeeAgent, equipo .net  
**Fecha:** 2026-05-28  
**Resumen:** Un solo anfitrión usa **BeeAgent** para conversar (SMS/WA/IG/Messenger/web) y **urbnbee.net** como marketplace de listings. Al conectar, las cuentas se alinean; el agente ve listings reales; el chat del listing en .net habla con el mismo cerebro en urbnbeeai.com.

---

## Los cuatro pilares (lo que pediste)

### 1. Cuentas enlazadas en **ambos sentidos**

**Hoy:** dos silos. BeeAgent = workspace `customers` + agentes. .net = `marketplace-store` (usuarios `role: host`).

**Regla:** el enlace siempre pasa por **urbnbeeai.com** (el SaaS del agente). urbnbee.net no sustituye el signup de BeeAgent; solo se **vincula** una cuenta host ya existente o se **crea** al vincular.

#### Camino A — Ya tiene urbnbeeai.com, aún no (o poco) en .net

1. Tenant activa tool **Host** en su agente.
2. En **Conectar urbnbee.net** → **“Usar mi email de BeeAgent”**.
3. .net recibe `provision` con ese email:
   - Si no hay host → **crea** usuario host + perfil vacío.
   - Si ya hay host con ese email → **vincula** `host_id` existente (conserva listings).
4. BeeAgent guarda `host_id` automáticamente.

#### Camino B — Ya tiene urbnbee.net, **no** tiene urbnbeeai.com

1. Desde .net (banner en panel host o listing): *“Activa tu agente AI en urbnbeeai.com”* → link a signup.
2. Crea cuenta en **urbnbeeai.com** (mismo email que en .net recomendado).
3. Crea agente con tool **Host** → **Conectar urbnbee.net**.
4. Opciones de vinculación (en orden de preferencia):
   - **“Ya tengo cuenta en urbnbee.net”** → login OAuth o código de un solo uso generado en .net (Integraciones → BeeAgent), **o**
   - **“Vincular con el mismo email”** → `provision` encuentra el host por email y enlaza sin duplicar.
5. Listings y datos en .net **no se mueven**; solo se asocia `host_id` al workspace BeeAgent.

```mermaid
flowchart TD
  subgraph pathA [Camino A: primero urbnbeeai.com]
    A1[Signup urbnbeeai.com] --> A2[Agente + tool Host]
    A2 --> A3[Conectar: email BeeAgent]
    A3 --> A4{.net tiene host con ese email?}
    A4 -->|no| A5[Crear host en .net]
    A4 -->|sí| A6[Vincular host_id]
    A5 --> A7[Listo]
    A6 --> A7
  end
  subgraph pathB [Camino B: primero urbnbee.net]
    B1[Host en urbnbee.net con listings] --> B2[Signup urbnbeeai.com mismo email]
    B2 --> B3[Agente + tool Host]
    B3 --> B4[Conectar: ya tengo .net / mismo email]
    B4 --> B5[Vincular host_id existente]
    B5 --> B7[Listo]
  end
```

**API propuesta (.net):**

```
POST /api/integrations/beeagent/v1/hosts/provision
Authorization: Bearer URBNBEE_PARTNER_API_SECRET
{
  "beeagent_customer_id": 123,
  "email": "host@ejemplo.com",
  "full_name": "Casa Tabo",
  "phone_e164": "+52..."
}
→ 200 { "host_id": "...", "created": true|false, "linked": true, "listings_count": 3 }
```

**Vinculación explícita (Camino B, email distinto o verificación extra):**

```
POST /api/integrations/beeagent/v1/hosts/link
Authorization: Bearer URBNBEE_PARTNER_API_SECRET
{
  "beeagent_customer_id": 123,
  "link_code": "ABCD-1234"   // generado en .net → Integraciones → BeeAgent, 10 min TTL
}
→ 200 { "host_id": "...", "display_name": "..." }
```

**UI BeeAgent** (`/agent/{id}/connect/urbnbee-net`):

| Botón | Cuándo |
|-------|--------|
| Vincular con mi email de BeeAgent | Camino A y B si el email coincide |
| Ya tengo cuenta en urbnbee.net — ingresa código | Camino B, email distinto o el host prefiere confirmar desde .net |
| Crear mi perfil en urbnbee.net | Solo Camino A si no existe host (automático vía provision) |

**UI .net** (`/host/settings/integrations`):

- “Conectar con urbnbeeai.com” → muestra **código de vinculación** o deep link.
- Texto: si aún no tienes cuenta en urbnbeeai.com, [crear cuenta](https://www.urbnbeeai.com/signup) primero.

BeeAgent guarda `host_id` en `agent_tool_subscriptions` (cifrado + `config` JSON).

---

### 2. El agente BeeAgent ve y usa listings de .net

**Capacidades del tool `host` (conversación SMS/WA/IG/etc.):**

| Capacidad | Tool / acción | API .net |
|-----------|---------------|----------|
| ¿Qué propiedades tengo? | `list_my_listings` | `GET /v1/listings?hostId=` ✅ hoy |
| Detalle (recámaras, amenidades, reglas, precio base) | `get_listing_details` | `GET /v1/listings/:id` ✅ hoy |
| ¿Hay lugar del 15 al 18? + precio | `check_listing_availability` | `GET /v1/host/availability` ❌ .net |
| Enviar link del listing al huésped | `send_listing_link` | usa `public_url` del listing ✅ |
| Registrar interés / lead | `open_listing_inquiry` | `POST /v1/booking-leads` (v0 inbox) → v1 lead formal |

**BeeAgent (implementación en curso):** handlers reales cuando hay `host_id` conectado; stub solo si no hay conexión.

---

### 3. Chat del listing en urbnbee.net → agente del tenant en urbnbeeai.com

**Hoy en .net:** `AiChatWidget` llama `POST /api/listings/:id/chat` — OpenAI local, **no** es el agente del host en BeeAgent.

**Objetivo:**

```mermaid
sequenceDiagram
  participant Guest as Huésped en listing
  participant Net as urbnbee.net widget
  participant AI as urbnbeeai.com API
  participant Worker as BeeAgent worker

  Guest->>Net: mensaje en chat del listing
  Net->>AI: POST /api/public/marketplace-chat
  Note over Net,AI: listing_id, host_id, session_id
  AI->>Worker: misma cola que SMS (conversation_key web:listing:slug)
  Worker->>AI: respuesta del agente asignado al host
  AI->>Net: reply
  Net->>Guest: muestra respuesta
```

**Requisitos:**

- Mapping **host_id (.net) → customer_agent_id (BeeAgent)** — el agente con tool `host` y mismo `host_id` en credenciales.
- Endpoint público en BeeAgent con rate limit + CORS desde `urbnbee.net`.
- .net: cambiar `AiChatWidget` para apuntar a urbnbeeai.com cuando el host tenga integración activa (flag en listing o host profile).

---

### 4. Misma identidad de negocio en ambos productos

| Concepto | urbnbeeai.com | urbnbee.net |
|----------|---------------|-------------|
| Tenant / negocio | `customers` | `host` user |
| Agente AI | `customer_agents` | — |
| Catálogo hospedaje | — | `listings` |
| Conversación huésped | inbox unificado | widget listing + inbox host |

El **mismo** `host_id` es la llave de unión.

---

## Fases de entrega

| Fase | Qué | Quién |
|------|-----|-------|
| **U.1** | Cuenta **A+B**: `provision` + `link` (código) + UI ambos lados + CTA .net → signup urbnbeeai.com | .net ✅ + BeeAgent |
| **U.2** | Tool host: list + detail + send link (API v0) | BeeAgent ✅ en progreso |
| **U.3** | Availability + precio por fechas en tool | .net API + BeeAgent |
| **U.4** | Widget listing → urbnbeeai.com worker | BeeAgent API pública + .net widget |
| **U.5** | Leads formales + webhook .net → agente avisa huésped | ambos |

---

## Qué NO mezclar

- `SISTEMA_PAGOS_Y_TIENDA_URBNBEE.md` = pagos **tienda/citas BeeAgent**, no checkout de reservas .net.
- Membresía **huésped** en .net (Stripe verification) ≠ suscripción SaaS BeeAgent.

---

## Referencias

- Contrato API target: `c:\Master URBNBEE Codex\docs\INTEGRATION_URBNBEE_NET_FROM_BEEAGENT.md`
- Opinión cruzada repo .net: `OPINION_REVIEW_BEEAGENT_CODEX_DOCS.md`
- API v0 real: `GET /api/integrations/beeagent/v1/meta` en prod
- Código .net partner: `web/app/api/integrations/beeagent/`
- Widget chat hoy: `web/components/listing/ai-chat-widget.tsx` → `/api/listings/[id]/chat`
- Código BeeAgent (otro repo): `src/lib/urbnbee-net-client.ts`, `src/lib/worker/tool-handlers.ts`

---

*Changelog: 2026-05-28 — Visión unificada a partir de requisitos de producto. Copia canónica en repo Urbnbee-Rentals.*
