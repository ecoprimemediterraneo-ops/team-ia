# AGENTS.md — Tropa (AI-Team)

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project overview

Next.js 16 App Router app for **AI-Team** — a SaaS platform offering 7 AI agents to Spanish small businesses (clínicas, peluquerías, restaurantes, etc.). Two surfaces:

- **Public landing** at `aiteam.marketing` — SEO pages, sector landings, blog, pricing, waitlist.
- **Client dashboard** at `/dashboard` — per-agent tools, calendar, social media, analytics. Auth-gated.

## Commands

```bash
npm run dev        # Next.js dev server on localhost:3000
npm run build      # Production build (runs on Vercel)
npm run lint       # ESLint (flat config, eslint-config-next)
```

There is **no `typecheck` or `test` script**. Run `npx tsc --noEmit` manually for type checking. No test framework is configured.

## Architecture

### Agent system (`src/lib/agents.ts`)

7 agents, each with a slug (`AgentSlug` type): `pablo`, `marta`, `carmen`, `eva`, `lucia`, `rocio`, `sergio`.

Each agent has:
- **Webhook route** at `src/app/api/<agent>/webhook/route.ts` (Pablo, Marta connected to Meta Cloud API)
- **Prompt file** at `src/lib/<agent>-prompt.ts` or system builder in `src/lib/claude.ts`
- **Dashboard page** at `src/app/dashboard/<agent>/page.tsx`

Model routing: fast agents (Pablo, Carmen, Lucía, Rocío) use `claude-haiku-4-5`; strong agents (Marta, Eva, Sergio) use `claude-sonnet-4-5`. Defined in `src/lib/claude.ts` → `MODEL_BY_AGENT`.

### Data layer

- **Supabase** (`src/lib/supabase.ts`) — used as a KV store (`kv_store` table). Functions: `kvGet`, `kvSet`, `kvListByPrefix`, `kvTryLock`/`kvUnlock`.
- **Local fallback** — when `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` are missing, most modules fall back to JSON files in `data/` dir (gitignored).
- **Multi-tenant** (`src/lib/tenants.ts`) — every client is a tenant. Default: `tenant_aiteam`. Tenant resolves from Meta `phone_number_id` or `instagram_user_id` on webhook receipt.
- **Conversation memory** (`src/lib/conversation-store.ts`) — key `conv:<channel>:<senderId>`, 24h TTL.

### Orchestrator (`src/lib/orchestrator.ts`)

Central booking logic. All agents (Pablo, Carmen, Eva, Lucía) go through `reservarSlot()` — never call `agendarCita()` directly. Uses in-memory mutex + distributed lock via `kvTryLock` to prevent double-booking.

### API routes (`src/app/api/`)

~70+ route files. Key groups:
- `<agent>/webhook/route.ts` — Meta webhook handlers (Pablo WhatsApp, Marta Instagram)
- `cron/<job>/route.ts` — Vercel cron jobs (see `vercel.json` for schedules)
- `eva/*` — email marketing (send, inbound, sequences, contacts, widget)
- `lucia/*` — Gmail OAuth, calendar, drafts, inbox
- `billing/*` — Stripe checkout + webhook
- `chat/[agent]/route.ts` — generic chat endpoint for dashboard

### Cron jobs (`vercel.json`)

Los 10 que declara `vercel.json` (hora UTC, plan Hobby → una pasada al día como
mucho, con ±59 min de margen). Están repartidos por hora a propósito: dos crons
a la misma hora se pisan y Vercel no garantiza el orden.

| Schedule | Route | Purpose |
|---|---|---|
| `0 3 * * *` | `/api/cron/sergio-scraper` | Lectura de webs de la competencia |
| `0 4 * * *` | `/api/cron/eval` | Evaluación nocturna |
| `0 5 * * *` | `/api/cron/sergio-analyze` | Análisis de lo leído |
| `0 7 * * *` | `/api/cron/lucia-daily-summary` | Resumen de bandeja de la mañana |
| `0 8 * * *` | `/api/cron/marta-publicar` | Publicación en redes |
| `0 9 * * *` | `/api/cron/booking-recordatorios` | Recordatorios de cita + lista de espera |
| `0 10 * * *` | `/api/cron/recall-dental` | Recall de revisiones + presupuestos parados |
| `0 9 * * 1` | `/api/cron/sergio-report` | Informe semanal de competencia (lunes) |
| `0 6 1 * *` | `/api/cron/marta-mes` | Calendario del mes (día 1) |
| `0 11 1 * *` | `/api/cron/informe-mensual` | Informe mensual al cliente (día 1) |

**Fuera de `vercel.json` a propósito**: `/api/cron/eva-dispatcher`,
`/api/cron/eva-sequences`, `/api/cron/marta-calendar-publicar` y
`/api/cron/publicar` necesitan más de una pasada al día (horaria, en el caso de
los dos de publicación), y el plan Hobby no lo permite. Se disparan desde n8n
con `CRON_SECRET`. Meterlos aquí los degradaría a una vez cada 24 h.

### Auth (`src/lib/auth.ts`)

JWT-based sessions via `jose`. Cookie: `team_ia_session` (30d, httpOnly). Magic link flow at `/login/verify`. Dashboard layout (`src/app/dashboard/layout.tsx`) calls `getSession()` → redirects to `/login` if null.

### Path alias

`@/*` maps to `./src/*`.

## Key patterns

- **Webhook routes MUST return 200 immediately** — Meta retries on errors, causing duplicate replies.
- **Instagram DMs require Page Access Token exchange** — System User EAA token doesn't work for `POST /{page_id}/messages`. See `getPageAccessToken()` in `marta/webhook/route.ts`.
- **Agent prompts need specific sections**: `USA EL HISTORIAL — NO PREGUNTES LO YA DICHO`, `REGLAS DE RECOMENDACIÓN`, `CTA OBLIGATORIO`, and format rules per channel (WhatsApp: `*bold*`; Instagram: NO markdown, use CAPS).
- **Antropic fallback**: if `ANTHROPIC_API_KEY` is missing, webhooks return a generic "hemos recibido tu mensaje" reply. This is intentional — not a bug.
- **`src/lib/claude.ts`** — lazy Anthropic client via Proxy + system prompt builders per agent.
- **`assets/**/*.md`** — social media strategy docs bundled into serverless functions via `outputFileTracingIncludes` in `next.config.ts`.

## Environment variables

Required for full functionality (see `.env.local.example`):
- `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `RESEND_FROM` — waitlist emails
- `ANTHROPIC_API_KEY` — agent AI responses
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — persistent storage (optional in dev, falls back to local JSON)
- `WHATSAPP_ACCESS_TOKEN`, `INSTAGRAM_ACCESS_TOKEN` — Meta Cloud API tokens (same System User EAA)
- `WEBHOOK_VERIFY_TOKEN`, `INSTAGRAM_VERIFY_TOKEN` — webhook validation
- `META_APP_SECRET` + `META_FIRMA_ESTRICTA` — firma de los webhooks de Meta (`src/lib/meta-firma.ts`). Sin secreto no se comprueba nada. **Con secreto se comprueba pero NO se rechaza** hasta poner `META_FIRMA_ESTRICTA=true`: en el despliegue de agosto de 2026 el secreto guardado era el de la app anterior y la comprobación recién puesta devolvió 401 a todo, dejando a Pablo mudo. Primero se mira el log (`FIRMA SIN COMPROBAR: firma que no cuadra`), y cuando cuadra, se enciende el rechazo.
- `FACEBOOK_PAGE_ID` — required for Instagram DM sending
- `AUTH_SECRET` — JWT signing key
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — billing

**WhatsApp Business — cuenta real (agosto 2026).** Pablo dejó el número de prueba de Meta:

| Dato | Valor | Variable |
|---|---|---|
| Número | +34 722 82 37 03 (nombre: AI-Team) | `NEXT_PUBLIC_WHATSAPP_NUMBER` (solo para el botón público) |
| Id del número | `1189470684259465` | `WHATSAPP_PHONE_NUMBER_ID` |
| WABA | `1409997207694647` | `WHATSAPP_BUSINESS_ACCOUNT_ID` |
| App de Meta | AI-Team Publisher · `2156272571817837` | `META_APP_ID` |

Los identificadores del número de prueba ya no valen.

**El id del número guardado en el tenant se reconcilia solo.** `seedTenants()` copiaba `WHATSAPP_PHONE_NUMBER_ID` la única vez que creaba el registro y ahí se quedaba congelado: al cambiar de número, la variable apuntaba al nuevo y el tenant guardado seguía con el viejo, sin que se notara porque `resolveTenantFromMeta` caía al tenant por defecto —que es el mismo—. Ahora `readAll()` compara la cuenta propia con el entorno en cada lectura, la corrige si difiere y lo deja escrito en el log (`[tenants] … Se actualiza al del entorno`). Solo se toca `tenant_aiteam`, y una variable vacía nunca borra lo guardado.

Cuando llega un `phone_number_id` que no es de ningún tenant, el log lo grita (`[tenants] SIN DUEÑO: …`) en vez de caer al de por defecto en silencio. Para verlo todo de un vistazo: `GET /api/admin/tenants-meta` (founder-only, solo lee).

Diagnóstico y prueba de envío sin exponer el token: `node scripts/whatsapp-prueba.mjs --estado` y `node scripts/whatsapp-prueba.mjs <movil>`.

### Cambiar de cuenta de WhatsApp: SUSCRIBIR LA APP A LA WABA

**El paso que se olvida, y deja el webhook mudo sin un solo error a la vista.**

La suscripción es de la app **a cada WABA por separado** y NO se hereda de la
cuenta anterior. En Meta todo se ve correcto —URL del webhook verificada, campos
suscritos, número de alta— y sin embargo no llega ni una petición a
`/api/pablo/webhook`, porque los campos se suscriben a nivel de app y la entrega
se activa por cuenta.

```bash
# 1. ¿Está suscrita?  (vacío = ese es el fallo)
read -s WHATSAPP_ACCESS_TOKEN && export WHATSAPP_ACCESS_TOKEN
node scripts/whatsapp-waba.mjs --estado

# 2. Suscribir y confirmar
node scripts/whatsapp-waba.mjs --suscribir
```

Equivale a `GET` y `POST` sobre `https://graph.facebook.com/v21.0/<WABA>/subscribed_apps`.
El token necesita `whatsapp_business_management` sobre esa cuenta.

**Lo demás que tampoco se migra** al cambiar de cuenta:

| Cosa | Qué pasa si se olvida |
|---|---|
| Suscripción de la app a la WABA | No llega nada al webhook |
| Plantillas | Se aprueban por cuenta: `132001` al enviar |
| Registro del número en Cloud API | El número no recibe; hace falta `POST /<phoneId>/register` con el PIN |
| App en modo **Desarrollo** | Solo llegan mensajes de quien tenga un rol en la app. Con el número de prueba no se nota (Meta da 5 destinatarios de prueba); con el número real, silencio |
| `whatsappPhoneNumberId` del tenant | Se guarda al crear el tenant y no se actualiza solo: el webhook cae al tenant por defecto |



**Interruptores de envío automático.** Todos OFF cuando la variable no existe:
el sistema calcula y lo enseña en el panel, pero no escribe a ningún cliente
final. Se documentan aquí porque `.env.local.example` está en `.gitignore`.

| Variable | Qué enciende | Por defecto |
|---|---|---|
| `MARTA_COMMENT_DM_ENABLED` | Comentario→DM para TODOS los tenants. El interruptor del día que Meta apruebe el App Review. | off |
| `MARTA_COMMENT_DM_TENANTS` | Lista de tenants (comas) con comentario→DM encendido mientras tanto. **Si la variable no existe, por defecto es solo `tenant_aiteam`** (la cuenta propia, la que se graba para el App Review). Ponla vacía para apagarlo también ahí. | `tenant_aiteam` |
| `RECALL_SEND_ENABLED` + `RECALL_TEMPLATE` | Avisos de revisión por WhatsApp (recall dental). | off |
| `PRESUPUESTOS_SEND_ENABLED` + `PRESUPUESTOS_TEMPLATE` | Recordatorios de presupuesto parado. | off |
| `INFORME_MENSUAL_SEND_ENABLED` | Envío por email del informe mensual al cliente (cron del día 1). Apagado, el cron recopila, renderiza y registra la decisión de cada destino en el log, pero no sale ningún correo. | off |
| `GESTORIA_RECLAMACION_SEND_ENABLED` + `GESTORIA_RECLAMACION_TEMPLATE` | Pedirle por WhatsApp al cliente de la gestoría la factura que falta. Va por plantilla (`gestoria_falta_factura`, 5 variables: cliente, gestoría, fecha, importe, concepto), porque se escribe fuera de la ventana de 24 h. Apagado, el panel prepara el texto y lo manda el gestor. | off |

Los avisos de recall y presupuestos llegan meses después de la última
conversación, o sea SIEMPRE fuera de la ventana de 24 h de WhatsApp: sin
plantilla aprobada por Meta (`*_TEMPLATE`) el mensaje no sale y el panel lo dice
como `sin_plantilla` en vez de darlo por enviado.

Comentario→DM además necesita que la Página esté suscrita al campo `comments`
del webhook de Instagram, que es una suscripción distinta de `messages`. Se
comprueba con `GET /api/admin/marta-comentarios` (founder-only, solo lee).

## Cómo escriben los agentes

Vive en `estiloDeCasa(canal)` (`src/lib/persona.ts`) y lo importan también los
prompts que tienen vida propia (`pablo-prompt.ts`, `claude.ts`). **Una sola
verdad**: si se copia a un prompt suelto, se queda viejo el día que cambie.

Nació de un mensaje real. A "hola", Pablo contestaba:

> ¡Hola! 👋
> ¿Qué tal, todo bien?
> ¿Hay algo en lo que pueda ayudarte?

Tres frases y ninguna útil. Un recepcionista de verdad contesta **"Hola, dime"** y espera.

- **Cero emojis.** Ninguno, en ningún mensaje, ni de adorno ni de remate.
- **Sin signos de apertura** en WhatsApp y en voz: se escribe `que tal?` y `vale!`, no `¿qué tal?` ni `¡vale!`. Solo el de cierre. En correo, Instagram y panel se escribe bien: ahí sí se nota.
- **Frases cortas, mensajes cortos.** Nada de párrafos, negritas, viñetas ni listas numeradas en WhatsApp.
- **Al saludo se contesta con un saludo y se espera.** No se ofrece ayuda, y desde luego no dos veces seguidas.
- **Prohibidas las fórmulas de asistente**: "¿en qué puedo ayudarte?", "estoy aquí para ayudarte", "no dudes en consultarme", "encantado de atenderte", "quedo a tu disposición".
- **Castellano de España, tuteo.** El voseo ya se coló una vez ("llevás", "por vos") en cuanto el tono se puso informal: la línea que lo prohíbe va la primera del bloque, y se verifica en cada tanda.
- No repetir el nombre del negocio en cada mensaje, ni anunciar lo que se va a hacer: se hace y ya.

Esto es **la forma**, no el fondo: las prohibiciones y el vocabulario de cada
sector (`sectores.ts`) siguen mandando. La gestoría sigue sin asesorar sobre el
fondo y la estética sigue sin dar precios.

**Cómo se comprueba**: `/admin/sectores` pasa el mismo mensaje a los cinco
sectores. Con "hola", "buenas, una pregunta", "cuanto cuesta?" y "puedes
ayudarme?" no puede salir ni un emoji, ni un `¿`, ni la palabra "ayudarte".

## Conventions

- **Language**: all UI copy, prompts, docs, and comments are in **Spanish (es-ES)**. Tuteo always.
- **Styling**: Tailwind CSS 4 via `@tailwindcss/postcss` plugin. CSS custom properties for brand colors (`--cream`, `--ink`, `--mustard`, etc.). Utility classes, no CSS modules.
- **Design**: "hard card" aesthetic — thick black borders, stencil fonts, 80s comic style. See existing components for the pattern.
- **No test framework** — verify changes manually via `npm run dev` and visual inspection.
- **Deploy**: Vercel (CLI or Git push). Production domain: `aiteam.marketing`.

## Existing skills (`.claude/skills/`)

- `diagnosticar-agente` — troubleshooting when Pablo/Marta stop responding
- `conectar-agente-meta` — step-by-step guide for connecting a new agent to Meta Cloud API
