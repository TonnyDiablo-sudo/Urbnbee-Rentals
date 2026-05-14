# Deploy a Railway — Urbnbee Marketplace

Esta guía levanta el proyecto (Next.js 16 en `web/`) en un **nuevo servicio de Railway**
y lo deja sirviendo en **`urbnbee.net`** mientras movemos el dominio definitivo después.

> **Importante:** Hoy la app guarda datos en archivos JSON (`web/data/*.json`) y fotos en
> `web/public/uploads/`. Sin un Volume persistente, **cada redeploy borra los datos
> nuevos**. Esta guía monta un Volume y apunta el código allí vía env vars (`URBNBEE_DATA_DIR`
> y `URBNBEE_UPLOADS_DIR`). Plan futuro: migrar a MySQL como dice `SYSTEM_ARCHITECTURE_AND_ROADMAP.md`.

---

## 0) Pre-requisitos

- Cuenta en [Railway](https://railway.com) con tarjeta vinculada (el Volume requiere plan Hobby+).
- Repo en GitHub (recomendado) — `git remote add origin …` antes de hacer `push`.
- Acceso a DNS de **urbnbee.net** (Cloudflare/registrar) para crear el `CNAME`.
- Llaves de Stripe (opcional para arrancar; se pueden agregar después).

---

## 1) Subir el código a GitHub

Desde la raíz del repo:

```powershell
git remote add origin https://github.com/<tu-usuario>/urbnbee-marketplace.git
git push -u origin main
```

> Si todavía no tienes el repo creado en GitHub, créalo vacío (sin README/license/.gitignore)
> y luego corre los comandos de arriba.

---

## 2) Crear el proyecto en Railway

1. **New Project → Deploy from GitHub repo** → selecciona el repo.
2. Railway creará un servicio automáticamente. Entra al servicio → **Settings**:
   - **Root Directory:** `web`
   - **Build / Deploy:** dejar en automático — Nixpacks leerá `web/railway.json`.
     Nixpacks ya ejecuta `npm ci` en la fase **install**; en `railway.json` el
     `buildCommand` debe ser solo `npm run build` (si duplicas `npm ci` en build,
     Nixpacks puede fallar con `EBUSY` en `node_modules/.cache`).
   - **Healthcheck:** ya viene configurado en `railway.json` (`/`, timeout 90s).

> Si Railway no detecta el root automáticamente, configúralo manualmente en
> *Settings → Service → Root Directory = `web`*.

---

## 3) Montar el Volume de persistencia

1. En el servicio → **Volumes → New Volume**.
2. **Mount path:** `/data`  (tamaño inicial: 1 GB sobra).
3. Confirma. Railway hará un redeploy.

Ese volumen es donde vivirá `data/` (JSON) y `uploads/` (fotos) entre deploys.

---

## 4) Variables de entorno

Ve a **Variables** y agrega (los marcados como **opcional** pueden quedar vacíos por ahora):

| Variable | Valor sugerido | Notas |
|----------|---------------|-------|
| `SESSION_SECRET` | string de 64 hex | Genera con `openssl rand -hex 32` o `python -c "import secrets;print(secrets.token_hex(32))"` |
| `URBNBEE_DATA_DIR` | `/data/json` | Persiste JSON (listings, usuarios, reservas, blog, etc.) |
| `URBNBEE_UPLOADS_DIR` | `/data/uploads` | Persiste fotos subidas por hosts/guests |
| `NODE_ENV` | `production` | Railway ya lo pone, pero confirmar |
| `STRIPE_SECRET_KEY` | `sk_live_…` o `sk_test_…` | Opcional al arranque |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | Se llena en paso 7 |
| `STRIPE_PRICE_VERIFICATION_MONTHLY` | `price_…` | Opcional. Sin esta var, no se exige suscripción para reservar |
| `PLATFORM_BOOKING_FEE_PERCENT` | `1` | Opcional, default 1% |
| `OPENAI_API_KEY` | `sk-…` | Opcional. Sirve a BeeBot y al blog bot |
| `BLOG_BOT_OPENAI_API_KEY` | (vacío) | Solo si quieres separar la key del blog del resto |
| `CRON_SECRET` | string aleatorio | Opcional. Para proteger `/api/cron/blog-scheduled` |

> El **PORT** lo inyecta Railway automáticamente y `next start` lo respeta. No lo definas tú.

Tras agregar las vars, Railway redepliega solo.

---

## 5) Comportamiento de seed en el primer arranque

El wrapper `web/scripts/start.mjs` hace, antes de `next start`:

1. `mkdir -p` en `URBNBEE_DATA_DIR` y `URBNBEE_UPLOADS_DIR`.
2. Copia los JSON semilla incluidos en el bundle (`web/data/*.json`: blog publicado,
   reserva demo, mensajes demo) al volumen — **solo si todavía no existen ahí**.
3. Lanza `next start`.

Por eso el primer deploy nace con los seeds de demo y los siguientes solo conservan
lo que escriba la app en producción. Si quieres arrancar **limpio**, conéctate por
`Railway shell` y borra los archivos del volumen antes del primer login.

---

## 6) Conectar dominio `urbnbee.net`

1. Servicio → **Settings → Networking → Custom Domain → Add Domain**.
2. Escribe `urbnbee.net` (y opcionalmente `www.urbnbee.net`).
3. Railway te dará un valor `CNAME` (algo como `xxx.up.railway.app`).
4. En tu DNS (Cloudflare/registrar):
   - **Apex (`urbnbee.net`):** Cloudflare permite `CNAME` flattening en raíz. Si tu DNS
     no lo soporta, usa un `ALIAS`/`ANAME`, o sube el dominio a Cloudflare DNS.
   - **`www`**: `CNAME` → el valor que dio Railway.
5. Espera 1–10 min a que Railway marque "Active" con el certificado emitido.

> Cuando muevas a otro dominio: solo agrega el nuevo en Networking, deja `urbnbee.net`
> activo durante la transición, y al final quítalo.

---

## 7) Webhook de Stripe

Cuando la app esté en `https://urbnbee.net`:

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. URL: `https://urbnbee.net/api/webhooks/stripe`
3. Eventos: `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`.
4. Copia el **Signing secret** (`whsec_…`) y pégalo en Railway como
   `STRIPE_WEBHOOK_SECRET`.

Railway redeploya y queda listo.

---

## 8) Verificación post-deploy

1. Abre `https://urbnbee.net` — debe cargar la landing.
2. **Subir foto:** entra como host → `/host/listings/new` → adjunta foto → la URL
   resultante (`/uploads/host-listings/…`) debe abrir bien en otra pestaña.
3. **Persistencia:** crea un listing/booking, dispara un redeploy desde Railway, y
   confirma que el dato sigue ahí.
4. **Stripe (si configurado):** dispara un test webhook desde Stripe Dashboard y
   confirma 200 en Railway logs.

---

## 9) Operación / troubleshooting

- **Logs en vivo:** servicio → **Deployments → View Logs**.
- **Shell remoto:** `Railway CLI → railway shell` (útil para `ls /data/json`).
- **Limpiar seed:** `rm /data/json/*.json` desde el shell + redeploy.
- **Backups:** el plan recomendado es migrar a MySQL pronto. Mientras tanto, descarga
  `/data/json` periódicamente vía shell (`tar czf - /data | base64`) hasta tener DB real.
- **Rollback:** Deployments → Redeploy en una versión anterior.

---

## 9b) CLI con **project token** (lo que usamos desde Cursor)

Si despliegas con `railway up` y un **Project token** (`RAILWAY_TOKEN`):

- **`railway whoami`** y **`railway link`** suelen responder *Unauthorized* — es normal;
  el token de proyecto no es una sesión de cuenta completa.
- **`railway up`** sí funciona. Si el proyecto tiene **más de un servicio**, añade
  el flag: `railway up -s <SERVICE_ID>` (el ID lo ves en la URL del dashboard o con
  *Ctrl+K → Copy Service ID*).
- **`railway variable set -s <SERVICE_ID> -e production KEY=VALUE`** funciona sin `link`.
- **Dominio custom** (`urbnbee.net`): si `railway domain` falla con el project token,
  créalo en el dashboard: *Networking → Custom Domain* (mismo resultado).

**Seguridad:** nunca pegues el token en un chat público; revócalo en *Project Settings → Tokens*
cuando termines el setup.

---

## 10) Notas para el agente / mantenedor

- Cualquier nuevo módulo que escriba a disco DEBE usar `getDataDir()` o `getUploadsDir()`
  de `web/lib/runtime-paths.ts`. **Nunca** hardcodear `process.cwd()/data` o
  `process.cwd()/public/uploads` — rompe la persistencia en Railway.
- La ruta `web/app/uploads/[...path]/route.ts` es la que sirve estáticos desde el volume;
  no cambiar su path público (`/uploads/...`) sin migrar URLs ya escritas en `marketplace-store.json`.
- Para producción real, sigue `SYSTEM_ARCHITECTURE_AND_ROADMAP.md` — el plan es MySQL,
  Stripe Connect y storage de fotos en Cloudinary/S3.
