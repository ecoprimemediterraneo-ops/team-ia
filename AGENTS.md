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
- `FACEBOOK_PAGE_ID` — required for Instagram DM sending
- `AUTH_SECRET` — JWT signing key
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — billing

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

Los avisos de recall y presupuestos llegan meses después de la última
conversación, o sea SIEMPRE fuera de la ventana de 24 h de WhatsApp: sin
plantilla aprobada por Meta (`*_TEMPLATE`) el mensaje no sale y el panel lo dice
como `sin_plantilla` en vez de darlo por enviado.

Comentario→DM además necesita que la Página esté suscrita al campo `comments`
del webhook de Instagram, que es una suscripción distinta de `messages`. Se
comprueba con `GET /api/admin/marta-comentarios` (founder-only, solo lee).

## Conventions

- **Language**: all UI copy, prompts, docs, and comments are in **Spanish (es-ES)**. Tuteo always.
- **Styling**: Tailwind CSS 4 via `@tailwindcss/postcss` plugin. CSS custom properties for brand colors (`--cream`, `--ink`, `--mustard`, etc.). Utility classes, no CSS modules.
- **Design**: "hard card" aesthetic — thick black borders, stencil fonts, 80s comic style. See existing components for the pattern.
- **No test framework** — verify changes manually via `npm run dev` and visual inspection.
- **Deploy**: Vercel (CLI or Git push). Production domain: `aiteam.marketing`.

## Existing skills (`.claude/skills/`)

- `diagnosticar-agente` — troubleshooting when Pablo/Marta stop responding
- `conectar-agente-meta` — step-by-step guide for connecting a new agent to Meta Cloud API
