# ROADMAP — AI-Team

Producto: sistema operativo de 9 empleados IA (Pablo, Rocío, Eva, Lucía, Marta, Carmen, Sergio, Diana, Tomás) para PYMES en España/LATAM.

Estado: **V1 Beta en producción**. Próximo hito: V1.1 (Meta API verificada) + primer cliente pagando.

---

## V1 Beta — actual (publicado en aiteam.marketing)

Lo que ya está hecho y en producción:

- **Web pública SEO** — ~200+ URLs. 9 sectores (`dentistas`, `estetica`, `abogados`, `asesorias`, `fisioterapeutas`, `gimnasios`, `peluquerias`, `podologos`, `restaurantes`) × 21 ciudades de `src/lib/ciudades.ts` → landings dinámicas en `<sector>/[ciudad]`. Más home, /agentes (9), /precios, /reclutar, /demo, /diagnostico, /casos, /sobre-nosotros, /legal, /calculadora, /integraciones.
- **Blog** — 14 posts en `src/lib/blog.ts` con páginas dinámicas en `/blog/[slug]`.
- **/vs** — 4 comparativas en `src/app/vs/[competidor]`.
- **Auth** — JWT cookie httpOnly (`src/lib/auth.ts`), magic-link preparado (`src/lib/magic-link.ts`).
- **Dashboard cliente** — `/dashboard` con páginas por agente (lucia, marta, pablo, eva, rocio, carmen, sergio, instagram, redes), perfil editable, valor, lecciones.
- **Dashboard admin** — `/admin/leads`, `/admin/pipeline`, `/admin/metricas`, `/admin/sergio`.
- **Diana (HOTEL-D8)** — diagnóstico real con Claude Sonnet + envío email Resend al lead y al equipo.
- **Eva (ECHO-E3)** — envío real desde `eva@aiteam.marketing` vía Resend. Templates, secuencias, contactos, widget de captura.
- **Lucía (BRAVO-L4)** — Gmail OAuth funcional (lectura, borradores, summarize, clean-promos, calendar webhook).
- **Tomás (TANGO-T9)** — widget de soporte 24/7 con Claude Haiku (`/api/tomas`).
- **Sistema redes** — `src/lib/redes.ts` con adapters IG/FB/LinkedIn/TikTok + modo asistido. Queue de 38 publicaciones precargadas en `src/data/queue-seed.json`.
- **Stripe** — scaffold checkout + webhook (sin products reales).
- **Newsletter** — API `/api/newsletter` + form en footer.
- **A/B test** — middleware con cookie `aiteam-variant` solo en `/`.
- **Cookie banner GDPR**, JSON-LD (Organization + SoftwareApplication), sitemap dinámico, robots, manifest PWA.
- **3 crons activos en `vercel.json`** — eval diario 04:00, lucia-daily-summary 07:00, eva-dispatcher 09:00.

**Criterio de éxito.** SEO indexado, formulario Diana entregando leads cualificados, demo navegable que cierra venta sin contacto humano.

---

## V1.1 — Meta API verificada

Pendiente solo de aprobación externa de Meta.

- **Verificar empresa** en business.facebook.com (1-3 semanas).
- **App Review** de `instagram_content_publish` + `pages_manage_posts` (2-4 semanas).
- **Activar cron `/api/cron/publicar`** en `vercel.json` (`0 * * * *`). Ya existe el código, no está activado en el schedule.
- **WhatsApp Business real para Pablo** (Cloud API + Twilio fallback).
- Una vez los tokens entran en env vars (`META_ACCESS_TOKEN`, `META_INSTAGRAM_USER_ID`, `META_FACEBOOK_PAGE_ID`, `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_ORG_URN`), los adapters dejan modo asistido y publican solos.

**Bloquea.** Revisión externa Meta (semanas, no controlable).
**Criterio de éxito.** 1 publicación auto en IG + 1 en LinkedIn + 1 conversación entrante real en WhatsApp gestionada por Pablo sin intervención humana.

---

## V1.2 — Primer cliente pagando

- **Stripe products reales** — 4 packs (Local 79 / Digital 149 / Élite 249 / Pro 449) + 3 add-ons Carmen (Start 99 / Pro 199 / Unlimited 349). Crear en dashboard Stripe + poblar `STRIPE_PRICES` en envs Vercel + verificar webhook `/api/billing/webhook`.
- **Run `/security-review`** sobre la rama actual antes del primer cobro.
- **Link en bio** del IG `@aiteam.marketing` apuntando a `/diagnostico`.
- **Foto de perfil Diana** definitiva en `/agentes/diana/diana.webp`.
- **Onboarding flow** real al pagar — flujo `/onboarding` ya existe, falta conectar al `checkout.session.completed`.

**Criterio de éxito.** 1 cliente pagando 79€+/mes con cobro automático recurrente Stripe.

---

## V1.3 — 10 clientes pagando

- **Vapi para Carmen** — número español + minutos + integración `/api/carmen/voice`. ~50€/mes base.
- **Sergio backend real** — migrar `sergio-db.ts` a tablas Supabase pobladas (ya hay estructura), activar crons `sergio-scraper` / `sergio-analyze` / `sergio-report` (existen como APIs, faltan schedules en `vercel.json`).
- **+15 posts blog SEO** (25-30 totales) — Doctoralia vs Klinik, reseñas Google 2026, cuánto cuesta no contestar WhatsApp, etc.
- **Sistema de referidos** — link único por cliente, 30% comisión. Manual hasta integrar con Stripe Connect.
- **Diego (nuevo agente)** — cold email B2B con Apollo/Hunter + Resend. Décimo agente del catálogo.

**Bloquea.** Carmen depende de número Vapi listo. Diego requiere fuente de contactos (Apollo paid).
**Criterio de éxito.** MRR ≥ 1.000 €/mes, churn < 10%.

---

## V2 — Escalado Supabase

- **Migración JSON → Supabase** por orden definido en `DATABASE.md`: users → diagnosticos → queue → newsletter → magic-links → conversaciones_tomas + evals.
- **/admin/metricas** con MRR, leads/mes, churn, NPS, coste por agente.
- **`/metodologia`** — página explicativa "cómo funciona AI-Team paso a paso" (objeción "cómo aprende mi negocio").
- **Dashboard demo público** `/demo/dashboard` con gráficas mock realistas (sin login).
- **RLS y multi-tenant real** en Supabase.

**Criterio de éxito.** 100 clientes activos con MRR ≥ 10.000 €/mes, datos persistidos sin pérdida en `/tmp`.
