# Marta · Instagram DMs — Setup Meta

Documentación de cómo configurar Meta App Review + webhooks de Instagram para activar Marta DMs en producción.

## Estado actual del código

Todo el módulo está implementado y desplegado:

- `src/app/api/marta/webhook/route.ts` — endpoint GET (challenge) + POST (eventos)
- `src/lib/marta-ig-meta.ts` — cliente Graph API + verificación firma
- `src/lib/marta-ig-classifier.ts` — clasificador intent con Claude
- `src/lib/marta-ig-responder.ts` — generador de respuestas con reglas duras
- `src/lib/marta-ig-db.ts` — capa Supabase (conversaciones, mensajes, leads)
- `src/lib/marta-ig-ratelimit.ts` — 1 msg/8s por usuario, 100/h global
- `scripts/migrations/002_marta_instagram.sql` — tablas Supabase

## Pasos para activar (cuando Meta apruebe la app)

### 1. Aplicar migración SQL

En Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql):

```bash
# Pegar y ejecutar el contenido de scripts/migrations/002_marta_instagram.sql
```

Crea las tablas `marta_ig_conversations`, `marta_ig_messages`, `marta_ig_leads`.

### 2. Variables de entorno en Vercel

Necesarias para que el módulo se active. Si faltan, el código sigue corriendo
pero todo cae en logs sin enviar nada a Meta (failsafe).

```bash
# Verificación de firma de webhooks (la pone Meta en cada POST)
META_APP_SECRET=<el App Secret de tu app Meta>

# Token que damos a Meta en el challenge inicial — string aleatorio que tú eliges
IG_WEBHOOK_VERIFY_TOKEN=<elige un string aleatorio largo, ej. openssl rand -hex 32>

# Token de página de larga duración (60 días, hay que refrescar antes)
IG_PAGE_ACCESS_TOKEN=<lo da Meta tras autorizar la página>

# ID de tu cuenta Instagram Business
IG_BUSINESS_ACCOUNT_ID=<lo das de alta en Meta Business>

# Versión Graph API (opcional, default v21.0)
IG_GRAPH_API_VERSION=v21.0

# Config del negocio que aparece como remitente
MARTA_NOMBRE_NEGOCIO=<ej. "Clínica Dental Sonrisa">
MARTA_SECTOR=<ej. "clínica dental">
MARTA_HORARIO=<ej. "L-V 9-19, S 10-14">
MARTA_SERVICIOS=<ej. "implantes, blanqueamiento, ortodoncia">
MARTA_TONO=cercano y profesional
```

### 3. Crear/configurar Meta App

1. https://developers.facebook.com/apps → "Create App" tipo Business
2. Añadir productos: **Instagram Graph API** + **Webhooks** + **Messenger**
3. Conectar cuenta IG Business (debe estar vinculada a Página FB)
4. Permisos a solicitar en App Review:
   - `instagram_basic`
   - `instagram_manage_messages`
   - `instagram_manage_comments`
   - `pages_manage_metadata`
   - `pages_read_engagement`
   - `pages_messaging`

### 4. Configurar Webhook

En la app Meta → Webhooks → Instagram:

- **Callback URL**: `https://aiteam.marketing/api/marta/webhook`
- **Verify Token**: el mismo string que pusiste en `IG_WEBHOOK_VERIFY_TOKEN`
- **Suscribir campos**: `messages`, `messaging_postbacks`, `comments`, `mentions`

Meta hará GET con `hub.challenge` → nuestro endpoint responde el challenge si el token coincide.

### 5. Generar Page Access Token de larga duración

Por defecto los tokens duran 1-2h. Para 60 días:

```bash
# Cambiar short-lived por long-lived
curl -X GET "https://graph.facebook.com/v21.0/oauth/access_token?\
grant_type=fb_exchange_token&\
client_id={META_APP_ID}&\
client_secret={META_APP_SECRET}&\
fb_exchange_token={SHORT_LIVED_TOKEN}"
```

Pegar el token resultante en `IG_PAGE_ACCESS_TOKEN` en Vercel.

**Importante**: programar recordatorio cada 50 días para refrescar el token antes de que caduque.

### 6. Pasar a modo Live

Tras App Review aprobado:

- Settings → Basic → "App Mode: Live"
- Verificar que `IG_BUSINESS_ACCOUNT_ID` y `IG_PAGE_ACCESS_TOKEN` están bien
- Mandar un DM de prueba a tu cuenta IG → debería contestar Marta en segundos

## Tests a hacer cuando llegue Meta App Review

- [ ] GET `/api/marta/webhook?hub.mode=subscribe&hub.verify_token=X&hub.challenge=abc` → devuelve `abc`
- [ ] POST con firma X-Hub-Signature-256 válida → 200 OK
- [ ] POST con firma inválida → 403
- [ ] DM real entrante → aparece fila en `marta_ig_conversations` y `marta_ig_messages`
- [ ] Mensaje con intent="pedir_cita" → crea registro en `marta_ig_leads` + email a founder
- [ ] Mensaje con intent="queja" → marca conversación `escalated` + email a founder + NO responde
- [ ] Rate limit funciona: 2 mensajes seguidos al mismo IG_USER_ID en <8s → solo el primero se envía
- [ ] Comentario público → respuesta corta pública + DM con respuesta completa

## Multi-tenancy (cuando haya múltiples clientes)

Hoy el módulo opera single-tenant (single founder). Cuando entren los pilotos:

1. Crear tabla `marta_ig_clientes` con: `business_account_id`, `owner_email`, `nombre_negocio`, `tono`, `horario`, `servicios`, `page_access_token`
2. En `webhook/route.ts` → `getNegocioConfig()` y `getOwnerEmail()` → leer de esa tabla en lugar de env vars
3. Cada cliente conecta su IG Business desde un OAuth flow en `/dashboard/marta`

Esto son ~2 días de dev adicionales cuando llegue el momento.
