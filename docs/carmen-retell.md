# Carmen en Retell: lo que se configura en su panel

Carmen (voz) funciona en **Retell**. La voz, el modelo y el número viven en el
panel de Retell; este repo pone las funciones. Todas llevan `?secret=<CARMEN_WEBHOOK_SECRET>`.

## 1. Webhook de llamada entrante (variables por negocio)
Agente → *Inbound call webhook*: `https://aiteam.marketing/api/carmen/entrante?secret=…`
Devuelve `{{negocio}}`, `{{saludo}}`, `{{saludo_en}}`, `{{movil_dueno}}`,
`{{palabras_urgencia}}`, `{{direccion}}`, `{{slug}}`.

## 2. Prompt (pegar al principio del prompt del agente)
```
Empieza SIEMPRE con: {{saludo}}  (en inglés: {{saludo_en}})
Eres una asistente virtual, no una persona. Si te preguntan si eres una persona o un robot,
dilo claramente: "Soy una asistente virtual de {{negocio}}".
Contesta en el idioma en que te hablen (español o inglés). Si hablan en inglés, pasa
idioma="en" a las funciones.
Si el cliente dice algo de esta lista o parecido: {{palabras_urgencia}}, llama a la
función urgencia. Si devuelve transferir_a, usa transfer_call a ese número. Si nadie
contesta, llama a urgencia con accion="sin_respuesta" y un resumen.
Para reservar, llama a agendar_cita con nombre, motivo, fecha_hora (y profesional si la
pide). Lee en voz alta el "message" que devuelve.
```
En *Language* del agente: **Multilingual** (español + inglés).

## 3. Funciones (Custom functions)
| Nombre | URL | Parámetros |
|---|---|---|
| agendar_cita | `/api/carmen/agendar?secret=…` | nombre, motivo, fecha_hora, telefono?, profesional?, idioma? |
| cancelar_cita | `/api/carmen/cancelar?secret=…` | telefono? |
| urgencia | `/api/carmen/urgencia?secret=…` | texto, telefono?, accion? ("sin_respuesta"), resumen? |
| transfer_call (de Retell) | número: `{{transferir_a}}` o `{{movil_dueno}}` | — |

## 4. Al colgar
*Webhooks* → `call_analyzed` → `/api/carmen/webhook?secret=…` (cuenta la llamada para el
informe y NO duplica la cita ya hecha en directo).

## 5. Llamadas salientes (recordatorio sin confirmar, demo)
Variables en Vercel: `RETELL_API_KEY`, `RETELL_AGENT_ID_SALIENTE` (un agente de Carmen para
salientes) y `CARMEN_FROM_NUMBER` (número de Retell ya comprado). Sin ellas, modo prueba.
Reglas en código: 9–21 h España, solo contactos previos, límite diario por negocio
(`carmenConfig.llamadasDiarias`, 20 por defecto).

## 6. Crons (desde n8n, con CRON_SECRET)
- `/api/cron/recordatorio-llamadas` — cada hora: llama a quien no confirmó el recordatorio en 3 h.
- `/api/cron/carmen-informe-semanal` — lunes 9:00 (hora de España); manda solo con `CARMEN_INFORME_SEND_ENABLED=true`.

## 7. Plantillas de WhatsApp (UTILITY, es + en)
`node scripts/whatsapp-plantillas.mjs --estado`. Cuando estén APPROVED:
`BOOKING_CONFIRMACION_TEMPLATE=aiteam_cita_confirmacion`, `BOOKING_RECORDATORIO_TEMPLATE=aiteam_cita_recordatorio`,
`CARMEN_INFORME_TEMPLATE=aiteam_informe_semanal`, `CARMEN_URGENCIA_TEMPLATE=aiteam_urgencia_dueno`.
