# PROMPT 8 — SERGIO: Unidad de Reconocimiento (inteligencia competitiva)

**Estado:** archivado · esperando orden para empezar

## Resumen ejecutivo
Sergio = 7º miembro del equipo, pero NO operativo (no contesta WhatsApps ni manda emails).
Es **inteligencia**: vigila competidores, detecta cambios, alerta.

**2 fases:**
- **Fase 1 (interna):** Sergio vigila a la competencia de AI-Team para nosotros.
- **Fase 2 (comercial):** Add-on de pago para clientes que vigilan su competencia local.

## Identidad visual
- Ciborg militar (NO humano como los otros 6)
- Paleta: gris metálico, negro mate, neón azul/rojo
- Sección separada dashboard: "INTELIGENCIA · EXPEDIENTE M-RECON"
- Frase: "Mientras tu equipo opera, Sergio vigila."

## Fases técnicas

### FASE 1 — Uso interno (sprints 1-3)

**Fuentes rastreadas (configurables):**
1. **Webs de competidores** — snapshot semanal, diff pricing/features/headline
2. **LinkedIn** — perfiles fundadores, contrataciones, anuncios financiación
3. **Crunchbase/Dealroom** — rondas, M&A
4. **G2/Capterra/Trustpilot** — reseñas, sentiment analysis con Claude
5. **Reddit/foros** — menciones del nicho
6. **Meta Ads Library** — anuncios activos competencia
7. **SerpAPI** — keywords + posición SERP

**Componentes:**
- Cron jobs Inngest/Trigger.dev
- Scraping Firecrawl (principal) + Browserless fallback
- Análisis Claude (sonnet/opus) clasifica relevancia
- Sistema de alertas (crítica/alta/media/baja)
- Informe semanal ejecutivo lunes 9:00 por email
- Dashboard `/admin/sergio`

### FASE 2 — Comercial (sprint 4)

**Diferencias:**
- Onboarding: cliente da ubicación + especialidad
- Detección automática competidores en radio configurable (2/5/10km) vía Google Places API
- Fuentes adaptadas: Google My Business, webs locales, IG/FB públicos, Google Local Ads, SERPs locales

**Informe quincenal personalizado** para cliente:
- "Esto pasó cerca de tu clínica esta quincena"
- Comparativa rating, SERP, presencia social
- 3 recomendaciones concretas

**Pricing:**
- Add-on básico: 49€/mes (5 competidores)
- Add-on premium: 79€/mes (15 + alertas tiempo real)
- Incluido en Pack Élite Dental como upsell

## Schema Supabase requerido

```sql
sources (id, type, url, competitor_name, category, frequency, active, config, created_at, last_scraped_at)
snapshots (id, source_id, scraped_at, raw_content, parsed_data, hash, created_at)
changes (id, source_id, snapshot_before, snapshot_after, change_type, diff, relevance, summary, detected_at, acknowledged)
alerts (id, change_id, channel, sent_at, opened)
insights (id, period_start, period_end, content, highlights, recommendations, generated_at)
```

## Plan de sprints (8 semanas)

| Sprint | Semanas | Contenido |
|---|---|---|
| **S1** | 1-2 | Schema Supabase + admin panel fuentes + scraping web básico + diff |
| **S2** | 3-4 | Análisis Claude + sistema alertas + email crítico + dashboard básico |
| **S3** | 5-6 | SerpAPI + Apify LinkedIn/reviews + informe semanal + dashboard completo |
| **S4** | 7-8 | Fase 2 — onboarding cliente + Google Places + dashboard cliente + Stripe add-on |

## ⚠️ Reality check de costes (lo que NO se dice en el prompt)

**APIs externas necesarias y su coste real:**

| Servicio | Free tier | Plan inicial | Notas |
|---|---|---|---|
| **Firecrawl** | 500 créditos/mes | $20-100/mes según volumen | Imprescindible para scraping limpio |
| **SerpAPI** | 100 búsquedas/mes | $50-150/mes | Para SEO + SERPs locales |
| **Apify** | $5 crédito gratis | $49/mes plan starter | LinkedIn + Google Maps |
| **Inngest** | Free hasta 50k events/mes | $20/mes después | Cron jobs |
| **Google Places API** | $200 crédito mensual gratis | Después $17 por 1k requests | Solo Fase 2 |
| **Supabase** | Free 500MB | $25/mes Pro | Para pgvector y +500MB |

**Coste mensual realista:**
- Solo Fase 1 con 20-30 competidores: ~$70-150/mes
- Fase 1+2 con clientes pagando add-on: ~$200-400/mes (se autofinancia con 10-15 add-ons vendidos)

## ⚠️ Riesgos legales (mis advertencias)

✅ **Permitido / limpio:**
- Webs públicas (respetar robots.txt)
- Reseñas Google públicas
- LinkedIn vía Apify oficial con cuenta business
- G2/Capterra/Trustpilot público
- Meta Ads Library (público por ley)
- SERPs (solo lectura)

⚠️ **Zona gris:**
- LinkedIn scraping intensivo → riesgo baneo cuenta
- Almacenar datos personales (nombres empleados) → atención GDPR

❌ **No hacer:**
- Acceso autenticado a webs de competencia
- Scraping ignorando rate limits
- Bypass de captchas

✅ **Posicionamiento correcto:**
- "Inteligencia de mercado"
- "Reconocimiento competitivo"
- NUNCA "espionaje", "espía", "hack"

## Dependencias

- **PROMPT 4** (Supabase) debe estar listo primero, Sergio lo usa intensivamente
- **PROMPT 7** (SDR) puede ir en paralelo si Supabase está
- Compatible con sistema de memoria y feedback ya implementado (PROMPT 4b/4d ✅)

## Diferenciación visual Sergio en código

```css
:root {
  --sergio-bg: #0a0a0f;
  --sergio-grid: #1a1a25;
  --sergio-accent: #00d4ff; /* neón azul */
  --sergio-danger: #ff3366; /* neón rojo */
  --sergio-text: #c8c8d0;
  --sergio-mono: ui-monospace, 'Cascadia Code', monospace;
}
```

Dashboard de Sergio = sección oscura tipo terminal militar, contrasta con resto del producto que es cómic ochentero claro.

## Por dónde empezar (cuando confirmes)

**Mi propuesta de orden:**
1. Esperar a tener Supabase (PROMPT 4)
2. **Sprint 1 de Sergio** primero (es la fundación): schema + admin fuentes + scraping web + diff
3. **Sprint 2**: análisis Claude + alertas → ya empezamos a recibir avisos útiles para AI-Team
4. **Sprint 3**: SerpAPI + Apify + informe semanal → herramienta interna completa
5. **Sprint 4**: comercializar a clientes (Fase 2)

Cada sprint = ~10-15h de dev. Total Fase 1: ~40h. Fase 2 añade ~15h.
