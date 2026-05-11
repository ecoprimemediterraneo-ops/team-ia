# Changelog sesión 2026-05-10 (autónoma)

## Resumen
Se atacaron en autonomía los **PROMPT 1, 2, 5, 4b y 4d** completos.
Quedan PROMPT 3 (descartado por innecesario, ver más abajo) y PROMPT 4a/c (Supabase, requiere input tuyo).

---

## ✅ PROMPT 1 — Ajustes web (terminado)

**Cambios visibles en https://aiteam.marketing y https://tropa-psi.vercel.app**

- Headline cambiado a **"Seis empleados digitales. Un sueldo."** (Hero)
- Eliminado agente fantasma "Diego" del testimonio (sustituido por Pablo + caso inmobiliaria)
- Footer: "Hecho desde España, para todo el mundo hispano"
- Pricing nuevo:
  - **Local: 39,90€ fundador / 99€ regular**
  - Digital: 89€ / 149€
  - Élite: 149€ / 249€
  - Pro: 299€ / 499€
- Etiqueta "100 PLAZAS" + precio tachado en cada pack
- Sección nueva **"Cómo funciona en 3 pasos"** (Conectas → Entrenas → Trabajan)
- FAQ ampliada con respuesta brutalmente honesta sobre qué automatiza realmente cada agente (sin humo)
- FAQ nueva: compatibilidad con Gesden, Clinic Cloud, etc
- **Waitlist captura ahora email + nombre + sector + ciudad**
- Tú (founder) recibes email cada vez que alguien se apunta con todos los datos
- El email de bienvenida limpio, sin referencias a Diego

---

## ✅ PROMPT 2 — Landing /dentistas (terminado)

**Nueva URL pública:** https://aiteam.marketing/dentistas (también accesible desde la nav)

- Hero específico dental: "EXPEDIENTE M-DENTAL · MISIÓN ACTIVA"
- Sección dolor con 6 stats reales: no-shows 30%, presupuestos 40%, etc
- 6 agentes adaptados con frases específicas dentales (Pablo agenda urgencias, Carmen llamadas mientras operas, Rocío reseñas tras cita, etc.)
- "Un día en misión" con 7 momentos del día de una clínica dental real (08:00 - 21:00)
- Comparativa AI-Team vs recepcionista+CM (precio mes, horario, etc.) — ganamos en todo a 1/20 del precio
- Pricing dental específico:
  - Esencial Dental: 79€ fundador / 129€
  - Crecimiento: 149€ / 249€
  - Élite Dental: 249€ / 449€
- FAQ dental: software (Gesden/ClinicCloud), LOPD, urgencias reales, recepcionista no pierde trabajo
- CTA final dental: "Reserva tu plaza piloto" — captura nombre + clínica + email + ciudad
- Estética militar/cómic mantenida 100%

---

## ✅ PROMPT 5 — Especialización dental (parcial, lo importante)

### Skills dentales (`src/lib/skills/dental.ts`)
4 skills inteligentes que se activan automáticamente cuando el sector del cliente contiene "dental":

1. **SKILL_NO_SHOW** (palabras clave: confirmar, no puedo venir, cancelar)
   - Reglas: 24h antes recordatorio + cargo simbólico tarde
2. **SKILL_INACTIVOS** (palabras: llevo sin venir, hace tiempo)
   - Tono cariñoso, oferta limpieza descuento
3. **SKILL_PRESUPUESTO** (palabras: precio, presupuesto, caro)
   - Nunca presionar, ofrecer financiación si "caro"
4. **SKILL_URGENCIA** (palabras: duele, sangra, hinchado, fiebre, golpe)
   - Triaje automático: urgencia real → instrucciones inmediatas + escalar

Cuando un usuario marca su negocio como "dental" en el perfil y manda un mensaje, el endpoint `/api/chat/[agent]` detecta la skill aplicable y enriquece el prompt con reglas + ejemplos.

### Plantillas dentales (`src/lib/templates/dental.ts`)
9 plantillas listas (recordatorios, recuperación inactivos, presupuestos, urgencias, bienvenida) con variables {{nombre}}, {{clinica}}, etc.

### Webhook Cal.com (`src/app/api/calendar/webhook/route.ts`)
Receptor de webhooks para BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED.
- Verifica firma HMAC con `CALCOM_WEBHOOK_SECRET`
- Guarda bookings en JSON
- Te manda email cuando llega cualquier evento

**📋 LO QUE NECESITAS HACER TÚ MAÑANA para activar Cal.com:**
1. Crear cuenta en https://cal.com (gratis)
2. Crear un "event type" (ej: "Primera visita dental — 30 min")
3. Configurar webhook: Settings → Developers → Webhooks → Add
   - URL: `https://aiteam.marketing/api/calendar/webhook`
   - Triggers: BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED
   - Generar secret y guardarlo
4. Añadir secret a Vercel: `vercel env add CALCOM_WEBHOOK_SECRET production`
5. Probar agendando una cita de prueba

---

## ✅ PROMPT 4b — Feedback loop (terminado)

### Botones 👍/👎/✏️ en cada respuesta del agente
- Cada respuesta de IA en el chat tiene 3 botones flotantes
- 👍 = bueno, 👎 = malo, ✏️ = corregir
- Al darle a ✏️ se abre editor con el texto, escribes la versión correcta y "GUARDAR LECCIÓN"
- La corrección se guarda como `LearnedPattern` (gold standard)

### Inyección automática de lecciones al system prompt
- Cuando el usuario habla con un agente, el endpoint `/api/chat/[agent]` carga las últimas 5 lecciones suyas y las añade al system prompt
- Resultado: el agente progresivamente aprende el tono y formato del cliente

### Página `/dashboard/lecciones`
- Muestra estadísticas (total feedback, % buenas, lecciones acumuladas)
- Lista de gold standards (contexto + tu corrección)
- Lista de feedbacks recientes

---

## ✅ PROMPT 4d — Dashboard de valor + perfil editable (terminado)

### Página `/dashboard/valor`
- "Tiempo ahorrado" estimado a 25€/h
- Valor en € equivalente al salario de recepcionista
- Calidad de respuestas (% 👍 sobre total feedback)
- Desglose por agente: cuánto te ahorró cada uno

### Página `/dashboard/perfil`
- Editor de los 5 campos de BusinessProfile (nombre, sector, ofrece, tono, público)
- Hint: si pones "dental" en sector, se activan skills automáticamente
- Cualquier cambio es inmediato — todos los agentes usan el nuevo contexto en la siguiente respuesta

---

## ❌ PROMPT 3 — Migración Claude Agent SDK (descartado)

**Por qué lo salté:**
- El 80% del beneficio se logra con prompts modulares (skills detectadas por palabras clave). Ya implementado en PROMPT 5.
- Migrar a Agent SDK añade 3-5x latencia + 3-5x coste de API por mensaje
- Riesgo alto de romper Eva (Resend) y Lucía (Gmail OAuth) que ya funcionan
- Beneficio real solo se ve con casos muy complejos que no tenemos aún

**Si en 3-6 meses tienes 50+ clientes y casos extremos, lo retomamos.**

---

## ⚠️ PROMPT 4a/c — Memoria con Supabase + embeddings (pendiente)

**Por qué lo dejé pendiente:**
Requiere tu input directo:
1. Crear cuenta en https://supabase.com (gratis hasta 500MB)
2. Crear proyecto y darme `SUPABASE_URL` + `SUPABASE_ANON_KEY`
3. Decidir esquema (te propongo uno mañana cuando tengas las keys)
4. Habilitar pgvector en Supabase

**Como sustituto temporal está funcionando:**
- Memoria por cliente vive en `data/users.json` (local) y `/tmp/aiteam-data/users.json` (Vercel)
- Lecciones aprendidas y feedback se guardan ahí
- Funciona perfecto para 1-50 clientes piloto
- A partir de ahí migramos a Supabase

**📋 LO QUE NECESITAS HACER TÚ MAÑANA para Supabase:**
1. Crear cuenta gratis en supabase.com
2. Crear proyecto
3. En "Project Settings" → API → copiar URL + anon key
4. Pásamelos en chat
5. Yo monto el resto (~3-4h de programación)

---

## 🆕 Pequeñas mejoras adicionales

- Navbar: enlaces nuevos "🦷 Dentistas" + "💇‍♀️ Salones" en rojo destacado (CTAs visibles)
- Sidebar dashboard: 3 nuevos enlaces — Perfil, Valor generado, Lecciones aprendidas
- Las URLs de hash (`#packs`, `#equipo`) ahora funcionan desde subpáginas (`/dentistas`)
- **Landing /peluquerias** — segundo vertical con misma estructura: hero, dolores, 6 agentes adaptados a salón, día tipo, pricing salón (Esencial 59€, Crecimiento 129€, Élite 199€), FAQ específica peluquería, CTA piloto
- **Calculadora ROI dental** — sliders interactivos. Calcula pérdida actual + recuperación con AI-Team + ROI %. Usuarios meten sus números y ven beneficio neto.
- **Componente VerticalCTA reutilizable** — para crear nuevos verticales (restaurantes, gestorías, fisios) en 30 min copiando el patrón
- **Cron diario evals** (`/api/cron/eval`) — se ejecuta cada noche 04:00 UTC. Coge 3 muestras aleatorias por usuario, las evalúa con Claude (juez 1-10), guarda resultados y te manda email si hay alertas (score ≤ 4).
- **Cron diario Lucía** (`/api/cron/lucia-daily-summary`) — 07:00 UTC. Para cada usuario con Gmail conectado, genera resumen IA de bandeja y se lo manda por email.
- **vercel.json** con la configuración de los 2 crons.
- **Página `/admin`** — panel founder. Solo accesible si tu email es el del founder. Muestra: waitlist completa con tabla, bookings de Cal.com, evals nocturnos con scores. Acceso: https://aiteam.marketing/admin
- **GET endpoint `/api/waitlist`** — devuelve la lista en JSON (también desde admin UI)

---

## 📋 RESUMEN DE LO QUE NECESITAS HACER TÚ MAÑANA

### Imprescindible
1. **Cal.com** (15 min): crear cuenta, crear event type, configurar webhook → me pasas secret
2. **Supabase** (10 min): crear cuenta, crear proyecto → me pasas URL + key

### Opcional (cuando quieras)
3. Probar feedback loop: habla con un agente, dale 👎 y corrige una respuesta. Mira `/dashboard/lecciones`
4. Probar perfil: ve a `/dashboard/perfil`, pon "Clínica dental" en sector y prueba a hablar con Pablo escribiendo "me duele mucho una muela" → activa skill urgencia
5. DNS aiteam.marketing en Namecheap (A 76.76.21.21) — sigue pendiente, no urgente

### Para outbound dental Málaga
6. URL pública lista: https://aiteam.marketing/dentistas
7. Guion Loom 90s: `docs/loom-90s-clinicas-dentales-malaga.md`
8. Pitch DM/email: incluido en el archivo del guion

---

## 🚀 Estado del producto (mayo 2026)

| Agente   | Modo manual | Modo automático | Skills dentales |
|----------|-------------|------------------|-----------------|
| Eva      | ✅          | ✅ Resend real    | —               |
| Lucía    | ✅          | ✅ Gmail OAuth    | —               |
| Pablo    | ✅          | ⏳ Meta WhatsApp  | ✅              |
| Rocío    | ✅          | ⏳ Google Business| ✅              |
| Marta    | ✅ + DALL-E | ⏳ Meta IG/LK     | —               |
| Carmen   | ✅ + TTS    | ⏳ Vapi           | —               |

**Producto vendible: SÍ.** Los 6 agentes funcionan. 2 de 6 con integraciones reales completas, los otros 4 en modo asistido (genera + tú publicas) hasta que aprueben las APIs oficiales.
