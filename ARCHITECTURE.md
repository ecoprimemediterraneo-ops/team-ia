# ARCHITECTURE — AI-Team (aiteam.marketing)

Sistema operativo de 9 empleados IA para PYMES (clínicas dentales/estéticas y servicios locales) en España y LATAM. Monolito Next.js 16.2.5 (App Router) + React 19 + TypeScript estricto. Sin GitHub conectado: deploy directo con Vercel CLI + token.

## Mapa de módulos

```
src/
├── app/
│   ├── (web pública SEO)
│   │   ├── page.tsx                home con A/B test
│   │   ├── agentes/                ficha por agente
│   │   ├── precios/  reclutar/  demo/  diagnostico/
│   │   ├── sobre-nosotros/  legal/  casos/  integraciones/
│   │   ├── calculadora/            ROI interactivo
│   │   ├── blog/[slug]/            14 posts (src/lib/blog.ts)
│   │   ├── vs/[competidor]/        comparativas (4 /vs)
│   │   ├── lead/  onboarding/  login/
│   │   └── <SECTOR>/[ciudad]/      9 sectores × 21 ciudades (~189 landings)
│   │       dentistas, estetica, abogados, asesorias, fisioterapeutas,
│   │       gimnasios, peluquerias, podologos, restaurantes
│   ├── dashboard/                  cliente logueado (perfil + 9 agentes + redes + valor + lecciones)
│   ├── admin/                      leads, pipeline, metricas, sergio
│   └── api/
│       ├── auth/{login,logout}
│       ├── chat/[agent]            chat genérico por agente
│       ├── diagnostico/            Diana (Sonnet) + Resend
│       ├── tomas/                  Haiku, widget público
│       ├── lucia/*                 Gmail OAuth (draft, inbox, summarize, clean-promos…)
│       ├── eva/*                   Resend (templates, sequences, contacts, send, widget)
│       ├── marta/*  pablo/  rocio/  carmen/  sergio/  pipeline/
│       ├── redes/importar          ingesta de calendarios .md de assets/
│       ├── billing/{checkout,webhook}   Stripe
│       ├── newsletter/  feedback/  lead/[token]/  perfil/  business/  waitlist/
│       └── cron/                   eval, lucia-daily-summary, eva-dispatcher,
│                                   eva-sequences, sergio-{scraper,analyze,report},
│                                   publicar
├── lib/   ~3.700 LOC TS
│   ├── claude.ts                   anthropic proxy + MODEL_BY_AGENT + system prompts
│   ├── auth.ts (45)  magic-link.ts (71)
│   ├── redes.ts (371)              adapter pattern IG/FB/LinkedIn/TikTok + motor
│   ├── redes-importer.ts           parsea .md de assets/ a queue
│   ├── store.ts (476)              KV Supabase con fallback JSON local
│   ├── sergio-{db,scraping,analysis,alerts}.ts
│   ├── blog.ts (489)               14 posts inline
│   ├── ciudades.ts                 21 ciudades ES
│   ├── agents.ts                   catálogo de 9 agentes
│   ├── gmail.ts  openai.ts  resend.ts  supabase.ts (kv_store)
│   ├── pipeline.ts  sequences.ts  email-personalization.ts
│   └── skills/dental.ts  templates/dental.ts
├── components/        ~50 .tsx (Hero, Packs, Diagnostico, TomasWidget, dashboards…)
├── data/              runtime JSON (gitignored) — queue.json, users.json
└── middleware.ts (27) A/B test cookie aiteam-variant solo en "/"
```

## Flujos críticos

### 1. Magic-link auth
`src/app/login` → POST `src/app/api/auth/login/route.ts` → `getUser()` (store) + `createSession()` (`src/lib/auth.ts`). El JWT (`jose`, HS256, 30 días) se firma con `AUTH_SECRET` y se guarda en cookie httpOnly `team_ia_session`. Existe además `src/lib/magic-link.ts` (token aleatorio + TTL 15 min en `data/magic-links.json`, ruta `/tmp/aiteam-data` en Vercel) pensado para envío por Resend; el login actual lo aceptaba a 1 paso, magic-link queda como capa preparada.

### 2. Diagnóstico Diana
`src/components/DiagnosticoForm.tsx` → POST `src/app/api/diagnostico/route.ts`. Valida con `zod`, llama a Claude Sonnet (`MODELS.strong`) con prompt que **obliga a estimar pérdida anual en €**, persiste en `data/diagnosticos.json` (o `/tmp` en Vercel) y dispara email con Resend al lead + a hola@aiteam.marketing.

### 3. Publicación redes (cola → adapter → cron)
`src/data/queue-seed.json` (38 publicaciones bundled, commit en repo) + runtime `data/queue.json` (gitignored, `/tmp` en Vercel). `src/lib/redes.ts` mezcla seed + runtime priorizando runtime por id. Adapters Instagram/Facebook (Graph v21), LinkedIn (`ugcPosts`), TikTok (placeholder). Si faltan envs → `asistido: true` con link a Creator Studio / LinkedIn share. Cron `src/app/api/cron/publicar/route.ts` (no listado en `vercel.json` aún — falta añadir schedule `0 * * * *`) protegido con `Bearer CRON_SECRET`. `redes-importer.ts` parsea `assets/**/*.md` (incluidos vía `outputFileTracingIncludes` en `next.config.ts`).

### 4. Tomás widget
`src/components/TomasWidget.tsx` → POST `src/app/api/tomas/route.ts`. Sin auth, system prompt con tabla de packs y estado real de cada agente, modelo Haiku 4.5 (`MODELS.fast`).

## Stack y decisiones

- **Next.js 16.2.5 + React 19 + App Router** — RSC por defecto, server actions, edge-friendly. Sin Pages Router.
- **Tailwind v4** (`@tailwindcss/postcss`) — sin plugin `typography` (prosa custom en `globals.css`).
- **Claude Haiku vs Sonnet** (`src/lib/claude.ts` MODEL_BY_AGENT):
  - Haiku 4.5: lucia, carmen, pablo, rocio, tomas (volumen alto, tareas mecánicas).
  - Sonnet 4.5: marta, eva, sergio, diana (creatividad, análisis, dinero en juego).
- **Persistencia tiered**: fallback JSON en `data/` para dev → Supabase `kv_store` cuando `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` presentes (`src/lib/store.ts` USE_SUPABASE). Sergio sí usa tablas propias en Supabase (`sergio-db.ts`).
- **Auth**: JWT con `jose` en cookie httpOnly, sin NextAuth. Magic-link preparado.
- **Integraciones externas**: Anthropic SDK 0.95, OpenAI 6 (vapi/voz futuro), Resend 6 (Eva real), googleapis 171 (Gmail OAuth Lucía + Calendar), Stripe 22 (scaffold), Supabase 2.105 (kv + Sergio), Meta Graph v21, LinkedIn v2.
- **Validación**: zod 4 en todas las APIs públicas.
- **Deploy**: Vercel CLI con token, sin Git conectado. `vercel.json` lista 3 crons (eval diario 04:00, lucia 07:00, eva-dispatcher 09:00); el cron de publicación de redes existe en código pero **no está activado** en vercel.json.
- **A/B test**: `src/middleware.ts` asigna cookie `aiteam-variant` (A/B) solo en `/`, TTL 90 días.
