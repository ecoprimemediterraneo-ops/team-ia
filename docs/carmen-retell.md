# Carmen en Retell

Carmen (voz) funciona en **Retell**: agente **CARMEN v2** (`agent_fcb25abf8b0347ad1cff69146e`,
LLM `llm_814f3d47ddcc1b85c8ce8881ac29`) en el número **+34 951 870 605** (Zadarma, SIP), que
siempre atiende con la última versión publicada. La voz y el número viven en Retell; el
prompt, las funciones y las variables se aplican **desde este repo**.

## 0. Cómo se cambia (siempre desde la versión publicada)
```
RETELL_API_KEY=… node scripts/carmen-retell-publicar.mjs            # enseña qué cambiaría
RETELL_API_KEY=… node scripts/carmen-retell-publicar.mjs --publicar # copia, cambia y publica
```
- Parte **siempre de la versión publicada** (nunca de copias viejas). Así no se pierde lo que
  se haya tocado en el panel, como la transferencia.
- Guarda copia en `../tropa-copias-retell/<fecha>-antes-publicar-v<N>/` y, al acabar, lee la
  versión publicada nueva y comprueba la transferencia.
- El texto está en `scripts/carmen-retell-config.mjs`: prompt de salón, frases de espera y
  frase de la transferencia.
- Estado a 29/09/2026: **publicada la versión 8**.

## 1. Identidad: el salón, con los datos de su ficha
- Carmen habla en nombre del negocio de agenda del tenant (`tenant.negocioAgenda`). En la
  cuenta propia es `demo` = **Salón Bella** (Av. Ricardo Soriano 42, Marbella; lunes a sábado
  de 9:00 a 20:00).
- El prompt no lleva datos fijos del negocio: usa `{{negocio}}`, `{{direccion}}`,
  `{{horario}}`, `{{servicios}}` y `{{telefono_negocio}}`. En el prompt, las funciones y las
  variables no aparece «clínica», «paciente», «dental», «AI-Team» ni «Bendito Arte»
  (lo comprueba `t12-carmen-cierre`).
- **Ahora** esas variables son las *variables por defecto* del LLM, que el script saca de
  la ficha pública (`/api/booking/demo`) cada vez que publica.
- **Tras desplegar:** poner en el número el *Inbound call webhook*
  `https://aiteam.marketing/api/carmen/entrante?secret=…`, que da las mismas variables en
  vivo en cada llamada (y el móvil del dueño). El código actual de producción aún no da
  `{{horario}}` ni `{{servicios}}`.

## 2. Nunca callada mientras consulta
- Todas las funciones propias (`agendar_cita`, `gestionar_cita`, `cancelar`, `urgencia`)
  llevan `speak_during_execution` y una descripción con varias frases de ejemplo («dame un
  momentito que lo miro en la agenda», «un segundito, lo compruebo», «vale, déjame ver qué
  hueco hay»…).
- El prompt le pide alternarlas y no repetir la última.
- Una función nueva sin frases hace fallar el script: hay que añadirlas en
  `FRASES_ESPERA`.

## 3. Funciones
| Nombre | URL (todas con `?secret=<CARMEN_WEBHOOK_SECRET>`) | Para qué |
|---|---|---|
| agendar_cita | `/api/carmen/agendar` | Coge la cita en directo (nombre, motivo = servicio, fecha_hora ISO, fecha_texto, telefono?, profesional?, idioma?). Si no hay hueco, devuelve 2 opciones. |
| gestionar_cita | `/api/carmen/cita` | consultar / cancelar / mover la cita del que llama. |
| cancelar | `/api/carmen/cancelar` | Manda el enlace de anular o cambiar por WhatsApp. |
| urgencia | `/api/carmen/urgencia` | Detecta la urgencia y manda el WhatsApp al dueño (plantilla `aiteam_urgencia_dueno`) siempre. Con `accion=sin_respuesta` avisa de que no cogió. |
| pasar_al_responsable | transfer_call **warm** a `{{movil_dueno}}` (= TEST_PHONE del dueño) | Pasa la llamada si hay urgencia o si el cliente pide una persona. Al dueño le dice: «Hola, soy Carmen. Te paso a un cliente que ha llamado al salón.» |

Transferencia **warm**: Retell marca el móvil él mismo por la línea de salida. La **cold**
(SIP REFER) la recibe Zadarma y no la conecta: se queda pidiendo un número.

## 4. Al colgar: `/api/carmen/webhook`
- En el agente: *Webhook URL* `https://aiteam.marketing/api/carmen/webhook?secret=…`.
  Retell se autentica por el `?secret=` o por su firma `x-retell-signature`
  (`v=<ms>,d=<hmac>`).
- Contesta **200** a todos los eventos (con 4xx Retell reintenta en bucle).
- Cada llamada cuenta como atendida para el informe semanal.
- **`call_ended` → WhatsApp al cliente** (`src/lib/carmen-al-colgar.ts`, código local,
  pendiente de desplegar):
  - Mira las citas de ese teléfono en ese negocio que se crearon, cambiaron o anularon
    durante la llamada.
  - Si se creó o cambió una cita, manda la confirmación con la plantilla
    `aiteam_cita_confirmacion`: día, hora, servicio, dirección y botón «Anular o cambiar».
  - Si se anuló, manda el aviso de anulación. Aún no hay plantilla aprobada: va como texto
    y solo llega si el cliente escribió por WhatsApp en las últimas 24 h. Queda preparada
    la variable `BOOKING_ANULACION_TEMPLATE`.
  - Si no hubo cita, no se manda nada. Tampoco se envía nada en llamadas salientes.
  - Nada se repite aunque Retell reenvíe el aviso (`avisosAlColgar` en la cita).
- Por eso, en una llamada de Carmen la confirmación **no** sale durante la llamada
  (`confirmarAlColgar`), sino al colgar. El aviso al dueño sí sale al momento.

## 5. Llamadas salientes (recordatorio sin confirmar, demo)
- Variables en Vercel: `RETELL_API_KEY`, `RETELL_AGENT_ID_SALIENTE` y `CARMEN_FROM_NUMBER`.
- Reglas en código:
  - solo de 9 a 21 h, hora de España;
  - solo a contactos previos;
  - límite diario por negocio (`carmenConfig.llamadasDiarias`, 20 por defecto).
- Zadarma necesita el número saliente elegido en la extensión 586351-100 (puesto el
  29/09/2026). Sin él, las salientes y las transferencias no salen.

## 6. Crons (n8n del VPS, credencial «AI-Team CRON Auth»)
- `cron-carmen-recordatorio-llamadas (1h)` → `/api/cron/recordatorio-llamadas`. **Activo**
  desde el 29/09/2026.
- `cron-carmen-informe-semanal (lunes 9:00)` → `/api/cron/carmen-informe-semanal`. **Activo**
  desde el 29/09/2026.
  - Solo envía con `CARMEN_INFORME_SEND_ENABLED=true` en Vercel, que **aún no está puesta**.
  - `?tenant=<id>` lo limita a un tenant.
  - El código local, pendiente de desplegar, incluye la cuenta propia (negocio de agenda
    sin sector) y cuenta las citas por el día en que se cerraron (`meta.agendadaEn`), no
    por el día de la cita.

## 7. Plantillas de WhatsApp (UTILITY, es + en, todas APPROVED)
`node scripts/whatsapp-plantillas.mjs --estado`:
- `aiteam_cita_confirmacion` (`BOOKING_CONFIRMACION_TEMPLATE`)
- `aiteam_cita_recordatorio` (`BOOKING_RECORDATORIO_TEMPLATE`)
- `aiteam_informe_semanal` (`CARMEN_INFORME_TEMPLATE`)
- `aiteam_urgencia_dueno` (`CARMEN_URGENCIA_TEMPLATE`)

Falta una de **anulación** (`BOOKING_ANULACION_TEMPLATE`, 5 variables: nombre, negocio,
cuándo, servicio, enlace para reservar).

## 8. Cómo probarlo
- Pruebas: `npm run -s test:unitarias` (incluye `t12-carmen-cierre`: frases de espera,
  identidad, WhatsApp al colgar e informe) y Playwright (17 recorridos).
- Llamada real: ver `docs/estado-agentes.md`.
