# PROMPT 7 — SDR automatizado y marketing 100% con tus propios agentes

**Estado:** archivado · pendiente de planificar tras recibir PROMPT 8

## Idea central
Los propios agentes de AI-Team venden y operan el marketing de la empresa. Dogfooding total: el caso de estudio principal es la propia empresa.

## Componentes pedidos

### 1. Prospección
- Scraping Google Maps / Doctoralia / Páginas Amarillas
- Enriquecimiento Clay API
- Eva clasifica y prioriza
- Output: pipeline 500-2.000 leads cualificados/mes

### 2. Outreach multicanal
- Eva: secuencias 5-7 emails hiperpersonalizados (datos enriquecidos)
- Pablo: WhatsApp 24/7 con sub-agente "venta consultiva"
- Marta: cold DM Instagram a clínicas con bajo engagement

### 3. Cualificación
- Carmen (Vapi): llama a leads con 3+ aperturas sin contestar
- Pablo: cualifica por WhatsApp (BANT)
- Solo cualificados llegan a Cal.com

### 4. Contenido
- Marta: 3-5 posts/sem LinkedIn/IG/TikTok
- Eva: newsletter semanal
- Artículos SEO largos automatizados

### 5. Reseñas y casos de estudio
- Rocío: pide y publica reseñas
- Eva: genera casos de estudio con datos reales (con permiso)

### 6. Onboarding + retención
- Lucía: secuencia bienvenida + informe ROI mensual
- Pablo: soporte WhatsApp
- Carmen: llamadas proactivas anti-churn

### 7. Recuperación leads fríos
- Eva: re-contacta 30/60/90 días a waitlist + perdidos con mensajes distintos

### 8. Dashboard interno
- Pipeline por etapa
- Métricas por agente (emails, demos, conversión, MRR generado)

### 9. Integraciones requeridas
- Apollo / Clay (enriquecimiento)
- Smartlead / Instantly (deliverability)
- Cal.com (agenda)
- Vapi (Carmen voz)
- Meta Graph API (Marta)
- Stripe (cobro)

### 10. Posicionamiento
- Caso de estudio principal: "AI-Team se vende sola con sus propios agentes. Cero comerciales humanos."

## Avisos honestos (mis advertencias antes de implementar)

### ⚠️ Riesgos legales / ToS
- **Scraping Google Maps / Doctoralia**: contra ToS. Riesgo demanda + bloqueo IP.
- **Scraping LinkedIn**: caso hiQ vs LinkedIn — está en gris.
- **Cold DM Instagram**: contra ToS Meta. Riesgo baneo cuenta.
- **GDPR**: scraping de emails personales sin base legal = multa.

### ✅ Alternativas limpias
- **Apollo.io** (free tier 60K leads/mes, datos comprados legalmente)
- **Hunter.io** (find emails de dominios)
- **LinkedIn Sales Navigator** (con cuenta, lectura permitida)
- **Comprar listados B2B** (Camerdata, eInforma, fichero AEMET clínicas)

### ⚠️ Cold email a escala
Requiere infra dedicada o tu reputación de dominio se hunde:
- **Smartlead.ai** o **Instantly.ai** ~$99-150/mes
- **Dominio secundario** (ej. `aiteam.app`, `getaiteam.com`) — el principal NO se usa para outbound
- **Warmup** automático 2-3 semanas antes de mandar nada en serio
- **SPF/DKIM/DMARC** perfectos en el dominio secundario

### ⚠️ Vapi (Carmen voz)
- $0.05-0.15/minuto
- 100 llamadas de 3 min = ~$15-45
- Cuando tengas 5-10 clientes pagando, se autofinancia

## Plan de implementación propuesto (sprints 2 sem)

| Sprint | Contenido | Yo solo | Coste mes |
|---|---|---|---|
| **S1** | Pipeline DB + dashboard interno + import CSV | ✅ | 0 € |
| **S2** | Eva secuencias hiperpersonalizadas + tracking | ✅ | 0 € |
| **S3** | Smartlead infra + dominio secundario + warmup | ❌ requiere tu compra | $99 + 10€/año dominio |
| **S4** | Pablo cualificación WhatsApp + sub-agente BANT | ✅ (tras tu WhatsApp Cloud API) | 0 € |
| **S5** | Carmen llamadas Vapi | ✅ (tras tu cuenta Vapi) | $5-50/mes según uso |
| **S6** | Marta content engine orgánico (sin cold DM) | ✅ | 0 € |
| **S7** | Lucía onboarding + retención + informes ROI mensual | ✅ | 0 € |
| **S8** | Casos de estudio + páginas SEO largas | ✅ | 0 € |

**Total dev:** ~16 semanas en paralelo a otras cosas
**Coste infra:** ~$120/mes recurrente cuando esté todo activo
**Punto break-even:** 3 clientes Pro o 8 clientes Local pagando

## Por dónde empezar (cuando demos verde)
1. S1 + S2 son **autónomos y gratis** → arrancar primero
2. Cuando tengas 100+ leads importados → S3 (Smartlead)
3. Cuando WhatsApp Cloud API esté aprobada → S4
4. Cuando 5 clientes paguen → S5 (Vapi) + S6 + S7 + S8 en paralelo
