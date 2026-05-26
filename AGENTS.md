<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# AI-Team (Tropa) — Instrucciones para agentes

## 1. Qué es esto

Agencia + sistema operativo de **9 empleados IA** para PYMES: clínicas dentales y estéticas, bufetes de abogados, asesorías, fisios, gimnasios, peluquerías, podólogos, restaurantes. España y LATAM.

**Promesa al cliente:** más clientes + menos contrataciones + ahorrar tiempo, todo en un único software fácil de implementar para no-técnicos.

**Diferencial:** todo integrado en un mismo producto (no 10 herramientas pegadas), self-service en pocos clics.

## 2. Stack (no proponer alternativas sin pedirlo)

- **Next.js 16.2.5 (App Router) + React 19 + TypeScript estricto** — monolito, sin Pages Router
- **Tailwind v4** sin plugin `typography`
- **Anthropic** (Haiku 4.5 + Sonnet 4.5 según agente, ver `src/lib/claude.ts`)
- **Supabase** (`kv_store` + tablas Sergio) con fallback JSON en `data/`
- **Resend** (Eva, diagnóstico, waitlist)
- **Stripe** (scaffold — pendiente real)
- **Twilio** vía Vapi para Carmen (voz) — add-on, no incluido en packs base
- **Meta Graph v21 + LinkedIn v2** para redes (adapter pattern)
- **Vercel CLI + token** (sin GitHub conectado, deploy directo `vercel deploy --prod`)

## 3. Reglas duras (no negociables)

- ❌ **NO crear SL nueva** — operamos con la actual
- ❌ **NO usar Antigravity** salvo para diseño UI puntual
- ❌ **NO usar Vapi como alternativa a Twilio** — Twilio es la base; Vapi solo envuelve a Carmen
- ❌ **NO conectar GitHub** al repo — deploy es CLI con token (ver ADR-002)
- ❌ **NO añadir NextAuth, Buffer, Ayrshare** ni equivalentes — ya hay decisiones tomadas (ADR-003, ADR-007)
- ❌ **NO commits a main sin avisar** si se está tocando código en producción
- ✅ Todas las APIs públicas validan con `zod` (ADR-008)
- ✅ Antes de tocar Next.js, leer `node_modules/next/dist/docs/` — la versión rompe convenciones del training

## 4. Cliente ideal y beta actual

- Beta 50 plazas en Málaga, 6 meses gratis
- Pricing 5 planes: Discover (gratis) / Local 79€ / Digital 149€ / Élite 249€ / Pro 449€
- Dogfooding actual: "Estética Marbella Bay"
- Sectores con landing dedicada: dentistas, estética, abogados, asesorías, fisios, gimnasios, peluquerías, podólogos, restaurantes × 21 ciudades ES (~189 landings)

## 5. Comandos esenciales

```bash
npm install
npm run dev          # localhost:3000
npm run build        # verificar antes de deploy
npx vercel --prod    # deploy directo (sin Git)
```

Sin envs configuradas, el sistema funciona con fallback JSON en `data/` (gitignored).

## 6. Dónde mirar primero

| Pregunta | Archivo |
|----------|---------|
| ¿Cómo está montado? | `ARCHITECTURE.md` |
| ¿Por qué se decidió X? | `DECISIONS.md` (ADRs numerados) |
| ¿Qué falta por hacer? | `PENDIENTES.md`, `ROADMAP.md` |
| ¿Esquema de datos? | `DATABASE.md` |
| ¿Bloqueado por terceros? | `PENDIENTES_EXTERNOS.md` |

## 7. Bloqueadores activos de monetización (foco)

1. **Stripe real** — hoy es scaffold
2. **RLS en Supabase** — multitenant sin aislar aún
3. **Onboarding self-service** — falta dropdowns por sector
4. **Pricing definitivo + cuotas** — 5 planes definidos, cuotas por agente sin atar

Cualquier propuesta de feature nueva se evalúa contra estos 4. Si no los desbloquea ni los apoya, va al ROADMAP, no al sprint.

## 8. Modelo por agente (no cambiar sin justificar coste)

- **Haiku 4.5** (volumen, mecánico): Lucía, Carmen, Pablo, Rocío, Tomás
- **Sonnet 4.5** (creatividad, dinero en juego): Marta, Eva, Sergio, Diana

## 9. Tono y voz

- Castellano de España, tuteo, directo y sin humo
- No usar: "garantizado", "100%", "único en el mercado", "revolucionario", "el mejor"
- Decir lo que el producto hace de verdad, no lo que querríamos que hiciera
- Honestidad sobre lo que está beta vs. ready (ver `realPercent` y `statusNote` en `src/lib/agents.ts`)

## 10. Los 9 agentes (catálogo)

| Slug | Nombre | Rol |
|------|--------|-----|
| pablo | Pablo | WhatsApp |
| rocio | Rocío | Reseñas Google |
| eva | Eva | Email Marketing |
| lucia | Lucía | Asistente Ejecutiva |
| marta | Marta | Community Manager |
| carmen | Carmen | Recepcionista de llamadas (add-on) |
| diana | Diana | Auditora / Diagnóstico |
| tomas | Tomás | Soporte 24/7 |
| sergio | Sergio | Inteligencia Competitiva |

Personalidad y prompts vivos en `src/lib/claude.ts` y `src/lib/agents.ts` — esos son la fuente de verdad, no este README.

## 11. Cómo trabajar conmigo (Claude)

- Tareas grandes → primero plan corto, luego ejecutar
- Si dudo entre dos caminos, pregunto antes de escribir código
- Antes de marcar algo "hecho" en una feature visible en navegador, verifico con `preview_*`
- Cambios destructivos (drop, reset, force-push, borrar archivos no míos) → confirmar siempre
- Si una decisión nueva merece quedar registrada → añadir ADR a `DECISIONS.md`
