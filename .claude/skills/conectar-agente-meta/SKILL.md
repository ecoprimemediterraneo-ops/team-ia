---
name: conectar-agente-meta
description: Guía paso a paso para conectar un agente de AI-Team a Meta Cloud API (WhatsApp Business o Instagram Messaging). Usar cuando se quiera dar de alta un canal Meta nuevo (p. ej. uno de los agentes pendientes que pase a usar IG/WhatsApp), regenerar un webhook que se rompió en Pablo o Marta, o añadir un canal Meta adicional. Cubre creación de la app en Meta, configuración del webhook, suscripción de campos, verify token, mapeo del sender, alta del handler en el repo, variables de entorno necesarias y autorización del número/cuenta en modo desarrollo. NO aplica a Carmen (voz), Eva (email), Lucía (agenda) ni Rocío (reseñas Google) — esos canales no son Meta.
---

## Cuándo usar esta skill

Úsala cuando el usuario pida:
- "Conecta un agente nuevo a WhatsApp / Instagram / Messenger"
- "Engancha [agente X] al webhook de Meta"
- "Vuelve a configurar el webhook de Pablo / Marta"
- "Añade un canal Meta a AI-Team"

NO uses esta skill para:
- Carmen (llamadas de voz IA) → integración Twilio/Vapi/ElevenLabs, no Meta.
- Eva (email marketing) → Resend/SendGrid/Postmark, no Meta.
- Lucía (agenda / gestión) → Cal.com / Google Calendar, no Meta.
- Rocío (reseñas de Google) → Google Business Profile API, no Meta.
- Si un agente Meta ya conectado deja de responder → `diagnosticar-agente`.

## Equipo de agentes y estado de conexión

Fuente única de verdad sobre quién es quién (no inventes roles distintos a estos):

| Agente | Rol | Canal | Estado | Aplica esta skill |
|---|---|---|---|---|
| **Pablo** | Cierre de ventas | WhatsApp Business (Meta Cloud API) | ✅ Conectado y funcionando | Sí (solo si hay que reconfigurar) |
| **Marta** | Captación / crecimiento | Instagram DMs (Meta Cloud API) | ✅ Conectada y funcionando | Sí (solo si hay que reconfigurar) |
| **Carmen** | Llamadas de voz IA | Telefonía (Twilio/Vapi + TTS) | ⏳ Aún no existe | **No** — canal no-Meta |
| **Eva** | Email marketing | SMTP/API (Resend/SendGrid/Postmark) | ⏳ Aún no existe | **No** — canal no-Meta |
| **Lucía** | Agenda / gestión de citas | Cal.com / Google Calendar | ⏳ Aún no existe | **No** — canal no-Meta |
| **Rocío** | Reseñas de Google | Google Business Profile API | ⏳ Aún no existe | **No** — canal no-Meta |

Si el usuario pide "conecta un agente nuevo", asume por defecto que se refiere a:
1. Crear un agente Meta adicional desde cero (canal nuevo en WhatsApp/Instagram/Messenger), o
2. Reconectar Pablo o Marta si algo se rompió.

Si lo que quiere es Carmen/Eva/Lucía/Rocío, dile que esta skill no aplica y que necesita el flujo de su canal real (Twilio, email, calendar, GBP).

## Contexto del proyecto

- **Repo:** `~/EQUIPO DE AGENTES IA/tropa` (Next.js 16, App Router).
- **Agentes Meta ya conectados (plantillas a copiar):**
  - **Pablo (WhatsApp Business, cierre de ventas):** webhook en `src/app/api/pablo/webhook/route.ts`, prompt en `src/lib/pablo-prompt.ts`.
  - **Marta (Instagram DMs, captación):** webhook en `src/app/api/marta/webhook/route.ts`, prompt en `src/lib/marta-prompt.ts`.
- **Memoria de conversación:** `src/lib/conversation-store.ts` — clave `conv:<channel>:<senderId>` en `kv_store` de Supabase (prod) / `data/conversations.json` (dev).
- **Identidad de Meta:** todos los tokens son del mismo System User EAA (long-lived) almacenado en Vercel como `WHATSAPP_ACCESS_TOKEN` y `INSTAGRAM_ACCESS_TOKEN`.
- **Página de Facebook conectada:** `FACEBOOK_PAGE_ID=1110804952118807` (necesaria para enviar DMs de Instagram vía Messenger Platform).
- **Hosting:** Vercel, dominio `aiteam.marketing`.

## Flujo paso a paso

### 1. Crear la ruta del webhook en el repo

Patrón a copiar (idéntico para WhatsApp y Instagram, cambian solo los campos del payload):
- `src/app/api/<agente>/webhook/route.ts`
- Export `GET` (handshake `hub.mode=subscribe` + `hub.verify_token`) → devuelve `hub.challenge` con `Content-Type: text/plain`.
- Export `POST` (recepción de eventos) → SIEMPRE responde `200 OK` rápido (si devuelves error, Meta reintenta y duplica respuestas).
- `runtime = "nodejs"` y `dynamic = "force-dynamic"`.

Copia la estructura de `src/app/api/pablo/webhook/route.ts` o `marta/webhook/route.ts` como plantilla.

### 2. Configurar las variables de entorno en Vercel

Para un agente WhatsApp nuevo necesitas:

| Var | Qué es | Dónde sacarla |
|---|---|---|
| `WEBHOOK_VERIFY_TOKEN` | Token compartido con Meta para validar el webhook | Lo inventas tú (string aleatorio) |
| `WHATSAPP_PHONE_NUMBER_ID` | ID interno del número emisor (NO el número en sí) | Meta → WhatsApp → API setup |
| `WHATSAPP_ACCESS_TOKEN` | EAA del System User con scope `whatsapp_business_messaging` | Business Manager → System Users → Generar |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WABA ID | Meta → WhatsApp → API setup |

Para Instagram Messaging:

| Var | Qué es | Dónde sacarla |
|---|---|---|
| `INSTAGRAM_VERIFY_TOKEN` | Verify token para el webhook (puede coincidir con el de WhatsApp o ser distinto) | Lo inventas |
| `INSTAGRAM_USER_ID` | IG user id (no username) de la cuenta Business/Creator | Graph API `/me?fields=id` con token de la cuenta |
| `INSTAGRAM_ACCESS_TOKEN` | EAA del System User con scope `instagram_business_manage_messages` | Mismo System User que WhatsApp suele valer |
| `FACEBOOK_PAGE_ID` | Page id conectada a la cuenta IG | Business Manager → Páginas |

> ⚠️ **Importante para Instagram:** el System User EAA token NO sirve para `POST /{page_id}/messages` directamente. Hay que intercambiarlo por un **Page Access Token** vía `GET /{page_id}?fields=access_token`. El webhook de Marta ya hace este cambio y lo cachea 1h en memoria (`getPageAccessToken` en `src/app/api/marta/webhook/route.ts`). Copia ese patrón.

Tras añadir las vars en Vercel (Production + Preview + Development), redeploya. En local, replícalas en `.env.local`.

### 3. Configurar el webhook en Meta

1. App en Meta for Developers → tu app → **Webhooks**.
2. Producto a configurar:
   - **WhatsApp Business** → suscribe el campo **`messages`** (sin esto NO llegan los POSTs).
   - **Instagram Messaging** → suscribe los campos **`messages`** y opcionalmente **`comments`** (Marta solo loguea comentarios, no responde aún).
3. Callback URL: `https://aiteam.marketing/api/<agente>/webhook`.
4. Verify token: el valor que pusiste en `WEBHOOK_VERIFY_TOKEN` / `INSTAGRAM_VERIFY_TOKEN`.
5. Pulsa "Verify and save" → Meta hace un GET, tu endpoint devuelve el `hub.challenge`. Si falla, mira que el dominio sea https + el verify token coincida exactamente.

### 4. Mapear el sender

Cada plataforma identifica al interlocutor con un campo distinto. El sender es la **clave** que usa `conversation-store` para guardar la conversación:

| Canal | Campo del payload | Ejemplo |
|---|---|---|
| WhatsApp | `entry[].changes[].value.messages[].from` | `34600111222` (sin '+') |
| Instagram DM | `entry[].messaging[].sender.id` | `17841405793187041` (IGSID, 17 dígitos) |
| Messenger | `entry[].messaging[].sender.id` | PSID |
| Comentario IG | `entry[].changes[].value.from.id` | IGSID público |

Pásalo a `appendTurn(channel, senderId, ...)` y `getConversation(channel, senderId)`.

### 5. Crear el prompt del agente

Archivo `src/lib/<agente>-prompt.ts`. Mírate `pablo-prompt.ts` o `marta-prompt.ts` como plantilla. Reglas clave a copiar:
- Sección `USA EL HISTORIAL — NO PREGUNTES LO YA DICHO` (sin esto el agente repregunta datos que el cliente ya dio).
- Sección `REGLAS DE RECOMENDACIÓN` con la regla de producto: autónomo → Esencial, 2-10 → Completo, varios locales/equipo grande → Pro.
- Sección `CTA OBLIGATORIO` cerrando con `https://aiteam.marketing/beta`.
- **FORMATO POR CANAL:**
  - WhatsApp: un solo asterisco para negrita (`*Completo*`).
  - Instagram: **ningún asterisco** (no renderiza markdown), usar MAYÚSCULAS.
- Si indica `[PRIMER MENSAJE]` → presentarse; `[CONVERSACIÓN YA INICIADA]` → al grano.

### 6. Dar de alta el handler — conectar memoria + Claude

En el `POST` del webhook, dentro del loop de mensajes:

```ts
const conv = await getConversation("<agente>", senderId);
const isNew = !conv || conv.turns.length === 0;
const reply = await generateReply(text, isNew, conv);
await send<Canal>(senderId, reply);
await appendTurn("<agente>", senderId, "user", text, name);
await appendTurn("<agente>", senderId, "assistant", reply, name);
```

`generateReply` construye `messages` como `[...conv.turns.map(t => ({role: t.role, content: t.text})), { role: "user", content: currentUserContent }]` y lo manda a `anthropic.messages.create` con `system: <AGENTE>_PROMPT`. Copia exactamente la firma de Pablo/Marta.

### 7. Autorizar el número / cuenta en modo desarrollo

Si la app está en modo **Development** (sin App Review aprobado):
- **WhatsApp:** solo puedes enviar a números añadidos en *Meta → WhatsApp → API setup → To*. Hasta 5 números. Si no, verás `(#131030) Recipient phone number not in allowed list`.
- **Instagram:** solo Test Users + admins de la app pueden DM-earse con la cuenta. Si recibes "User not eligible", el sender no está autorizado.

Para producción real necesitas App Review aprobado (`whatsapp_business_messaging`, `instagram_business_manage_messages`).

## Checklist verificable de alta

Marca cada uno antes de declarar "agente conectado":

- [ ] `src/app/api/<agente>/webhook/route.ts` creado con GET (handshake) + POST (eventos) devolviendo 200.
- [ ] `src/lib/<agente>-prompt.ts` creado con las secciones de historial, recomendación, CTA y formato por canal.
- [ ] Variables de entorno presentes en `.env.local` Y en Vercel (Production + Preview + Development).
- [ ] `WEBHOOK_VERIFY_TOKEN` / `INSTAGRAM_VERIFY_TOKEN` definido y coincide con el de la configuración de Meta.
- [ ] Webhook dado de alta en Meta con callback `https://aiteam.marketing/api/<agente>/webhook` y "Verify and save" pasó OK.
- [ ] Campo `messages` suscrito en el producto correspondiente (sin esto NO llegan POSTs reales).
- [ ] Sender mapeado al campo correcto del payload (`from` en WhatsApp, `sender.id` en IG).
- [ ] Handler llama a `getConversation` + `appendTurn` con `channel="<agente>"`.
- [ ] Para Instagram: `getPageAccessToken` implementado (intercambio de System User → Page Token).
- [ ] Número de prueba autorizado (WhatsApp) o Test User añadido (Instagram).
- [ ] Test end-to-end: mandas un mensaje real desde un número/cuenta autorizada, ves el POST en `vercel logs --follow`, llega respuesta del agente, aparece la conversación en `kv_store` con clave `conv:<agente>:<senderId>`.
- [ ] Si el agente responde con el fallback `"Hola, hemos recibido tu mensaje…"`, falta `ANTHROPIC_API_KEY` en Vercel.

## Errores comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| Meta dice "Verify and save failed" | Verify token no coincide o el endpoint no devuelve `hub.challenge` como `text/plain` | Compara tokens char a char, revisa el `GET` |
| Webhook configurado pero no entran POSTs | Falta suscribir el campo `messages` | Meta → Webhooks → Suscripciones → marca `messages` |
| `(#131030) Recipient phone number not in allowed list` | Modo dev y número no autorizado | Añadir el número en API setup → To |
| `(#190) This method must be called with a Page Access Token` | Usando System User EAA contra `/messages` de IG | Intercambiar por page token (`getPageAccessToken`) |
| Cliente recibe respuesta pero genérica ("Hola, hemos recibido tu mensaje…") | Falta `ANTHROPIC_API_KEY` en el entorno | Añadirla en Vercel |
| Agente repregunta datos ya dichos | Memoria no enchufada al webhook, o se está llamando antes del `appendTurn` | Verificar paso 6 |
