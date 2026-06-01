---
name: diagnosticar-agente
description: Procedimiento de diagnóstico cuando un agente de AI-Team (Pablo en WhatsApp, Marta en Instagram, o cualquier otro conectado a Meta Cloud API) deja de responder mensajes. Comprueba en orden — de más probable a menos — los logs de Vercel, el webhook activo en Meta, la validez del token (caducidad/permisos), la autorización del número o cuenta en modo dev, el fallback por falta de ANTHROPIC_API_KEY, la memoria de conversación y la cuota de la app. Usar siempre que un agente "ya no contesta", "responde el mensaje genérico", o "se quedó callado".
---

## Cuándo usar esta skill

Úsala cuando el usuario diga:
- "Pablo / Marta no responde"
- "Le he mandado un WhatsApp y no contesta"
- "El agente responde mensajes genéricos / siempre lo mismo"
- "El webhook estaba bien y ahora no llega nada"
- "Marta responde pero con asteriscos raros"
- "El bot ha dejado de funcionar"

Si lo que se quiere es conectar un agente **nuevo**, usa `conectar-agente-meta`.

## Equipo y a qué agentes aplica esta skill

| Agente | Rol | Canal | ¿Aplica? |
|---|---|---|---|
| Pablo | Cierre de ventas | WhatsApp Business (Meta) | ✅ Sí |
| Marta | Captación / crecimiento | Instagram DMs (Meta) | ✅ Sí |
| Carmen | Llamadas de voz IA | Twilio/Vapi | ❌ No (aún no existe; canal no-Meta) |
| Eva | Email marketing | SMTP/API | ❌ No (aún no existe; canal no-Meta) |
| Lucía | Agenda / gestión | Cal.com / Google Calendar | ❌ No (aún no existe; canal no-Meta) |
| Rocío | Reseñas de Google | Google Business Profile API | ❌ No (aún no existe; canal no-Meta) |

Esta skill diagnostica **solo** agentes que pasan por Meta Cloud API. Si el problema es en voz/email/agenda/reseñas, no aplica.

## Contexto del proyecto

- Pablo (WhatsApp, cierre de ventas): `src/app/api/pablo/webhook/route.ts`, prompt `src/lib/pablo-prompt.ts`.
- Marta (Instagram DMs, captación): `src/app/api/marta/webhook/route.ts`, prompt `src/lib/marta-prompt.ts`.
- Memoria: `src/lib/conversation-store.ts` (kv_store en Supabase / fichero local).
- Tokens: `WHATSAPP_ACCESS_TOKEN`, `INSTAGRAM_ACCESS_TOKEN` (mismo EAA del System User).
- `FACEBOOK_PAGE_ID=1110804952118807`.
- Hosting: Vercel · dominio `aiteam.marketing`.

## Orden de comprobaciones (más probable → menos)

### Paso 1 — ¿Llega el POST al webhook?

**Qué mirar:**
```bash
cd "/Users/cristobalserrano/EQUIPO DE AGENTES IA/tropa"
npx vercel@latest logs https://aiteam.marketing --follow
```
Busca líneas `[pablo/webhook] POST payload:` o `[marta/webhook] POST payload:`.

**Si NO aparecen tras mandar un mensaje real:** el problema está en Meta → ir al **Paso 2**.

**Si aparecen pero la respuesta no llega al cliente:** el problema está en el envío (token o destinatario) → ir al **Paso 4**.

**Si aparecen pero el `AI reply` es siempre la frase genérica `"Hola, hemos recibido tu mensaje. Te respondemos en breve."`:** falta API key de Anthropic → **Paso 5**.

### Paso 2 — Webhook activo en Meta

1. Meta for Developers → tu app → Webhooks.
2. Comprueba que el producto correcto (WhatsApp / Instagram Messaging) tiene **callback URL** apuntando a `https://aiteam.marketing/api/<agente>/webhook`.
3. Verifica que el campo **`messages`** sigue suscrito (Meta a veces lo des-suscribe tras 7-30 días si la app está en dev o si hay errores 5xx repetidos).
4. Si está des-suscrito: pulsa "Subscribe" sobre el campo `messages` y re-test desde Meta ("Test" → envía un payload de prueba).

**Síntoma típico:** webhook "verde" pero campo `messages` no marcado → no entran POSTs.

### Paso 3 — Validez del token (caducidad / permisos)

Verifica el token actual contra Graph API:

```bash
TOKEN=<contenido de WHATSAPP_ACCESS_TOKEN>
curl -s "https://graph.facebook.com/v21.0/debug_token?input_token=$TOKEN&access_token=$TOKEN" | jq
```

Mira:
- `data.is_valid: true`. Si es `false` → token caducado o revocado, hay que regenerar.
- `data.expires_at: 0` (long-lived / System User) o timestamp futuro.
- `data.scopes` debe incluir:
  - **WhatsApp:** `whatsapp_business_messaging`, `whatsapp_business_management`.
  - **Instagram:** `instagram_business_manage_messages`, `pages_manage_metadata`, `pages_messaging`.

Si falta un scope: regenerar el System User token con los scopes correctos en Business Manager.

Para Instagram, además, el flujo cachea un **Page Access Token** con TTL 1h en memoria del módulo. Si tras un redeploy / cold start ese token también está caducado, el reintento debe regenerar — pero si Meta rotó el page token globalmente hay que volver a hacer `GET /{page_id}?fields=access_token`.

### Paso 4 — ¿Se está enviando bien la respuesta?

Si el AI reply se genera (visible en logs) pero el cliente no recibe nada, mira el `TX result` justo después.

| Error en el log | Significado | Solución |
|---|---|---|
| `(#131030) Recipient phone number not in allowed list` | Modo dev, número no autorizado | Meta → WhatsApp → API setup → To → añadir |
| `(#100) Param recipient must be a valid number` | El sender mapeado mal (con '+' o con espacios) | Comprueba que pasas `msg.from` tal cual |
| `(#190) This method must be called with a Page Access Token` | Instagram: usando System User en `/messages` | Verificar `getPageAccessToken` está activo |
| `(#10) Application does not have permission for this action` | Falta scope o app en modo dev sin Test User | Regenerar token con scopes / añadir Test User |
| `(#80007) Rate limit hit` | Demasiados mensajes por unidad de tiempo | Esperar; revisar lógica de respuesta |
| `(#368) The action attempted has been deemed abusive` | Spam policy de Meta | Revisar contenido del prompt; bajar volumen |
| `failed to fetch page token: status=401` | Token de Instagram caducado al intercambiar por page token | Regenerar `INSTAGRAM_ACCESS_TOKEN` |

### Paso 5 — Fallback de `ANTHROPIC_API_KEY`

Si el cliente recibe siempre exactamente:
> `"Hola, hemos recibido tu mensaje. Te respondemos en breve."` (Pablo)
> `"¡Hola! Hemos recibido tu mensaje, te respondemos en breve."` (Marta)

Es porque `process.env.ANTHROPIC_API_KEY` es `undefined` y el webhook entra al `if (!ANTHROPIC_API_KEY)` antes de llamar a Haiku.

**Solución:** Vercel → Settings → Environment Variables → `ANTHROPIC_API_KEY` para Production. Redeploy.

### Paso 6 — Memoria de conversación

Si el agente responde pero **repregunta datos ya dichos**:

1. Confirma que el handler llama a `getConversation` antes de `generateReply`:
   ```ts
   const conv = await getConversation("pablo", from);
   ```
2. Confirma que se pasa `conv` a `generateReply` y este construye `messages` como `[...conv.turns.map(...), { role: "user", content: ... }]`.
3. Comprueba que la conversación se está guardando:
   - **Prod (Supabase):** Supabase → Table editor → `kv_store` → busca filas con key `conv:pablo:*` o `conv:marta:*`.
   - **Dev (fichero):** `cat data/conversations.json | jq`.
4. ¿Stale por TTL? Por defecto 24h sin actividad → reset on-read. Si quieres ventana más larga, `CONVERSATION_TTL_HRS` en env.
5. Si los turnos están bien pero el agente sigue repreguntando: revisa que el prompt incluya la sección `USA EL HISTORIAL — NO PREGUNTES LO YA DICHO`.

### Paso 7 — Formato visible mal (asteriscos sueltos en IG, etc.)

| Síntoma | Causa | Solución |
|---|---|---|
| Marta escribe `**Completo**` literal en el DM | Le falta la regla "Instagram no renderiza markdown" | Añadir la sección de formato a `marta-prompt.ts` |
| Pablo escribe `**Completo**` doble asterisco en WhatsApp | Confusión con markdown estándar | Recordarle en prompt: UN solo asterisco para negrita |
| Las respuestas salen con `[PRIMER MENSAJE]` o `[CONVERSACIÓN YA INICIADA]` visible | El modelo está devolviendo el marcador del input | Revisa el `system` y reforzar "Devuelve SOLO el texto del mensaje" |

### Paso 8 — Cuota / rate-limit / App Review

- **App en modo dev caducado:** Meta a veces deshabilita apps que no han pasado App Review tras unas semanas. Síntoma: `(#10)` o webhook que silenciosamente deja de entregar.
- **Rate limit de WhatsApp:** tier 1 = 1.000 conversaciones únicas / 24h. Si superas, error 80007.
- **Token revocado por cambio de contraseña:** si alguien del Business Manager cambió la contraseña, todos los tokens de ese usuario quedan inválidos. Solución: regenerar System User token.

## Diagnóstico exprés (60 segundos)

Cuando no tengas tiempo de hacer todos los pasos, dispara este chequeo rápido:

```bash
# 1. ¿Prod responde?
curl -s -o /dev/null -w "%{http_code}\n" https://aiteam.marketing/  # esperado: 200

# 2. ¿Webhook GET handshake responde?
curl -s "https://aiteam.marketing/api/pablo/webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=test"
# esperado: "test"

# 3. ¿Logs recientes muestran POSTs?
npx vercel@latest logs https://aiteam.marketing --since 30m | grep "pablo/webhook\|marta/webhook"

# 4. ¿Token válido?
curl -s "https://graph.facebook.com/v21.0/debug_token?input_token=$TOKEN&access_token=$TOKEN" | jq '.data | {is_valid, expires_at, scopes}'
```

Si los 4 pasan → el problema es semántico (prompt, memoria, formato).
Si falla 1 → infra Vercel.
Si falla 2 → verify token o redeploy roto.
Si falla 3 → Meta no está entregando (campo `messages` no suscrito).
Si falla 4 → token caducado/revocado.

## Después de arreglar

1. Manda un mensaje real desde un número/cuenta autorizado.
2. Comprueba `[<agente>/webhook] AI reply:` en los logs.
3. Confirma que el cliente recibe la respuesta del agente (no la genérica).
4. Verifica que la conversación se guarda en `kv_store` con clave `conv:<agente>:<senderId>`.
5. Si el fix incluyó cambio de código, no olvides: **revisar en localhost antes de hacer push → deploy**. Usa la skill `deploy-seguro-aiteam`.
