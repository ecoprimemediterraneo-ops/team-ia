# DECISIONS — Architecture Decision Records

Formato: contexto / decisión / consecuencias.

## ADR-001 — Carmen como add-on, no incluida en packs base
**Contexto.** Carmen (recepcionista por voz) requiere Vapi (~50€/mes por número + minutos), coste variable que rompe el margen de un pack a 79€.
**Decisión.** Sacar Carmen de Local/Digital/Élite/Pro y venderla aparte (Start 99€ / Pro 199€ / Unlimited 349€) — ver `src/app/api/tomas/route.ts` y `src/lib/agents.ts` (statusNote "en alta Vapi").
**Consecuencias.** Margen estable en packs base. Carmen sólo se enciende cuando el cliente paga delta. Demos siguen en modo texto desde `CarmenTools.tsx`.

## ADR-002 — Deploy Vercel CLI + token, sin GitHub conectado
**Contexto.** Iteración solo del owner, sin equipo. GitHub añadiría fricción (PRs, checks) sin valor a esta escala.
**Decisión.** `vercel deploy --prod` con token personal. `.vercel/` commiteado para retener `project.json`.
**Consecuencias.** Velocidad máxima. Sin previews automáticos por PR ni historial de despliegues atado a commits. Si entra colaborador, hay que conectar GitHub.

## ADR-003 — Adapter pattern para redes (Meta, LinkedIn, TikTok)
**Contexto.** Cada red social tiene API y auth distintas; no queremos atarnos a Ayrshare/Buffer (30-50€/mes y dependencia).
**Decisión.** Interfaz `RedAdapter { esConfigurado(), publicar() }` en `src/lib/redes.ts`. Una implementación por red. El motor `publicarPendientes()` itera sobre `queue` y delega.
**Consecuencias.** Añadir una red = nuevo adapter, sin tocar el motor. Coste 0 € externo. Cada red mantiene su OAuth/token en env vars (`META_ACCESS_TOKEN`, `LINKEDIN_ACCESS_TOKEN`…).

## ADR-004 — Modo asistido como fallback cuando no hay token
**Contexto.** Verificación Meta tarda 1-3 semanas + App Review para `instagram_content_publish`. No podemos bloquear features mientras esperamos.
**Decisión.** Cada adapter chequea `esConfigurado()`; si no, devuelve `{ ok: true, asistido: true }`. El estado de la publicación pasa a `"asistida"` y la UI muestra link a Creator Studio / LinkedIn share (`urlAsistido()` en `redes.ts`).
**Consecuencias.** Producto vendible desde el día uno con calidad "borrador listo + 1 clic". Cuando llegan los tokens, basta poblar env vars — cero cambio de código en consumidores.

## ADR-005 — Tomás con Claude Haiku, no Sonnet
**Contexto.** Soporte 24/7 dentro del producto. Volumen potencial alto (cada cliente lo usa varias veces/día). Sonnet sería 3-5× más caro.
**Decisión.** `MODEL_BY_AGENT.tomas = MODELS.fast` (`claude-haiku-4-5-20251001`). Prompt detallado con packs y estado real de cada agente para compensar.
**Consecuencias.** Coste manejable a 100+ clientes. Respuestas algo más cortas/literales, pero el system prompt obliga a derivar a humano si no sabe → mitiga errores.

## ADR-006 — Queue: seed bundled + runtime en /tmp
**Contexto.** `data/` está gitignored y `/tmp` en Vercel se borra entre lambdas. Pero queremos que las landings y dashboards muestren publicaciones precargadas siempre.
**Decisión.** `src/data/queue-seed.json` (38 posts) commiteado e importado en `src/lib/redes.ts`. `load()` mergea seed + runtime priorizando runtime por `id`.
**Consecuencias.** Demo siempre tiene contenido aunque el runtime se reinicie. Cuando un usuario edita una publicación seed, su versión runtime tiene prioridad. Cuando se migre a Supabase (ver DATABASE.md), el seed se queda como bootstrap inicial.

## ADR-007 — JWT en cookie httpOnly con `jose`, sin NextAuth
**Contexto.** Magic-link sin contraseña, perfiles ligeros. NextAuth añadiría DB, adapters y dependencias innecesarias.
**Decisión.** `src/lib/auth.ts` (45 LOC) firma JWT HS256 con `AUTH_SECRET`, cookie `team_ia_session` httpOnly + sameSite=lax + 30 días.
**Consecuencias.** Cero dependencias extra. Rotación de `AUTH_SECRET` invalida todas las sesiones; aceptable por ahora.

## ADR-008 — `zod` en todas las APIs públicas
**Contexto.** APIs aceptan input de formularios y widgets externos; runtime types no protegen.
**Decisión.** `zod` schemas en `/api/diagnostico`, `/api/tomas`, `/api/auth/login`, `/api/newsletter` y resto.
**Consecuencias.** Errores 400 claros, sin runtime crashes. Schema es la documentación de facto del payload.

## ADR-009 — A/B test en middleware, no en cliente
**Contexto.** Hero alterna variante A/B para medir conversión.
**Decisión.** `src/middleware.ts` (27 LOC) asigna cookie `aiteam-variant` solo en `/`, una vez por visitante (90 días). El render lee la cookie en servidor.
**Consecuencias.** Sin parpadeo en cliente (FOUC), SEO-safe (HTML coherente con variante). `matcher: ["/"]` evita coste en el resto de rutas.

## ADR-010 — KV híbrido: Supabase con fallback JSON
**Contexto.** Dev local sin Supabase debe funcionar. Producción no debe perder datos en `/tmp`.
**Decisión.** `src/lib/store.ts` chequea `USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY)` y elige backend en runtime. La tabla `kv_store` actúa como key-value genérico (`kvGet`/`kvSet`).
**Consecuencias.** Onboarding de dev nuevo = `npm i && npm run dev` sin envs. Producción sin Supabase configurado pierde datos entre redespliegues (asumido hasta cierre del primer cliente).

## ADR-011 — Tailwind v4 sin plugin `typography`
**Contexto.** El plugin añade 20KB y choca con clases custom de marca.
**Decisión.** Estilos de prosa escritos a mano en `globals.css` para el blog y diagnóstico (markdown via `react-markdown`).
**Consecuencias.** Más trabajo manual al añadir elementos (table, blockquote), pero control total de tipografía y dark mode.

## ADR-012 — `outputFileTracingIncludes` para .md de assets
**Contexto.** `redes-importer.ts` lee calendarios editoriales en `assets/*.md` para poblar la queue. En el bundle serverless por defecto, Next no incluye archivos no importados estáticamente.
**Decisión.** `next.config.ts` declara `outputFileTracingIncludes: { "/api/redes/importar": ["./assets/**/*.md"] }`.
**Consecuencias.** La API funciona en producción. Cuidado al añadir nuevos consumidores de assets — replicar la regla.
