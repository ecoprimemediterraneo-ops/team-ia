# Estado de los agentes: Carmen, Pablo y Marta (30/09/2026)

«En producción» es lo que está funcionando en aiteam.marketing y en Retell ahora.
«En local» es código probado en verde, **pendiente de desplegar**.

## Carmen (voz, Retell, +34 951 870 605)

**Funciona en producción**
- Atiende como **Salón Bella** (el negocio de agenda `demo` de la cuenta propia), con
  dirección, horario y servicios de su ficha. Se presenta como asistente virtual.
  Es la **versión 8 de CARMEN v2**, publicada.
- Coge, cambia y anula citas en la llamada, con el mismo motor y el mismo candado que Pablo
  y el panel. Si no hay hueco, ofrece los 2 más cercanos. Nunca dice «cerrado» por un error
  de agenda ni promete llamadas que nadie va a hacer.
- Habla mientras consulta la agenda, con frases cortas que va alternando.
- En las urgencias manda un WhatsApp al dueño (plantilla aprobada) y le pasa la llamada.
  También se la pasa si el cliente pide una persona. La transferencia es *warm* y va al
  móvil del dueño (TEST_PHONE).
- El aviso de fin de llamada entra con 200 y cuenta la llamada para el informe.
- Llamadas salientes: la de prueba a TEST_PHONE llegó y se oía bien, con el número saliente
  de Zadarma ya puesto.
- n8n: el cron de llamadas de recordatorio (cada hora) y el del informe semanal (lunes
  9:00) están activos con la credencial «AI-Team CRON Auth».

**En local (pendiente de desplegar)**
- WhatsApp al colgar: confirmación de la cita creada o cambiada con la plantilla
  `aiteam_cita_confirmacion`, y aviso de la anulada. Si no hubo cita, nada.
- La ruta entrante da también `{{horario}}`, `{{servicios}}` y `{{telefono_negocio}}`.
- Caché corta de tenants y fichas: `/api/carmen/cita` pasa de p50 835 ms / p95 987 ms a
  p50 218 ms / p95 313 ms, y de 4 lecturas a 1. Es una medición local con Supabase simulado
  a 150-250 ms por lectura. En producción, antes del cambio: p50 929 ms / p95 1559 ms.
- Informe semanal:
  - incluye la cuenta propia;
  - cuenta las citas por el día en que se cerraron;
  - admite `?tenant=`.

**Falta**
- **Prueba real de la transferencia:** desde OTRO teléfono, llamar a Carmen, pedir «hablar
  con una persona» y comprobar que suena el móvil del dueño y que, al cogerlo, Carmen dice
  «Te paso a un cliente que ha llamado al salón». La transferencia *cold* por Zadarma no
  conectaba; la *warm* está configurada pero sin probar de punta a punta.
- **Desplegar** el código local y, después:
  - poner en el número de Retell el *Inbound call webhook* `/api/carmen/entrante`;
  - poner `CARMEN_INFORME_SEND_ENABLED=true` en Vercel para que el informe del lunes se
    envíe.
- **Informe semanal:** lanzar a mano una ejecución y enviarlo a TEST_PHONE (bloqueado por
  permisos en esta sesión).
- **Plantilla de anulación** en Meta (`aiteam_cita_anulada`). Sin ella, el aviso de
  anulación solo llega dentro de la ventana de 24 h de WhatsApp.

**Cómo probarlo**
- `npm run -s test:unitarias` (12 suites) y Playwright (17 recorridos, ver `tests/e2e`).
- Llamada desde tu móvil al +34 951 870 605:
  - pide cita («quiero una manicura mañana a las once»);
  - escucha la frase de espera mientras mira la agenda;
  - comprueba que se presenta como Salón Bella;
  - cuelga. Tras desplegar, te llega el WhatsApp de confirmación.

## Pablo (WhatsApp)

Auditoría del 29/09/2026 con 12 conversaciones simuladas (webhook firmado como Meta, envío
simulado) contra la cuenta propia → **Salón Bella**. Ahora pasan las 12; están en
`tests/e2e/pablo.spec.ts` (P1–P11) y las reglas fijas en `tests/unitarias/t14-pablo-reglas.ts`.

| Caso | Antes | Ahora (en local, pendiente de desplegar) |
|---|---|---|
| Cita con día y hora | 2 mensajes (confirmación automática + «Listo, Cliente») | **1 mensaje** con la cita tal como quedó guardada: servicio real, día, profesional, dirección y enlace para anular |
| Cita sin hora («¿qué horas tenéis el viernes?») | volvía a preguntar el día; con «la primera» decía «no estamos abiertos» | ofrece 2 huecos **reales** de ese día (mañana y tarde) y reserva el elegido |
| Hueco ocupado | 2 alternativas reales | igual |
| Domingo / fuera de horario | «a esa hora no estamos abiertos» | «ese día estamos cerrados» / «a esa hora no…» + 2 huecos reales |
| Servicio que no existe | **guardaba** «blanqueamiento dental» | dice que no, lista los servicios **reales** de la ficha y no guarda nada |
| Cambiar / anular | funcionaba (anular pide «sí») | igual, con redacción corregida |
| Precio, horario, dirección | correcto, de la ficha | igual |
| Inglés | contestaba en español y guardaba el servicio inventado «manicure» | contesta en inglés y guarda **Manicura** |
| Pide una persona | «te atiendo yo» (sin avisar a nadie) | **avisa al WhatsApp del dueño** (plantilla de urgencia) y se lo dice al cliente |
| Urgencia (reacción alérgica…) | le ofrecía cita | **avisa al dueño** y le recomienda ir al médico si empeora |
| Nota de voz ilegible | pide que lo escriba | igual |
| Mensaje a las 3:00 | contesta a cualquier hora; «mañana» se calcula en hora de España | igual (sin cambios) |

**Reglas nuevas (las mismas que Carmen):**
- Solo se confirma una cita que está **guardada** en la agenda (`citaGuardada`).
- Si la respuesta libre del modelo dice «te he agendado» sin haber guardado nada, se sustituye por
  la pregunta de los datos que faltan.
- Servicio estricto (`servicioPedido`): acepta inglés y erratas («manicure», «massage»), pero nunca
  cae en el primero de la lista, y palabras sueltas como «pelo» o «tratamiento» no bastan.
- Los avisos (al dueño, email) salen **después** de responder.
- Pablo y Carmen nombran solo servicios de la ficha, nunca categorías como «tratamientos faciales
  o corporales». Para Carmen, esa regla está publicada en la versión 8.

**Producción ahora (commit 3cd84ef, 30/09):** los arreglos de esta tabla, la memoria de clienta y
las reseñas están desplegados. Carmen v2 publicada en la **versión 9**, con el *Inbound call
webhook* `/api/carmen/entrante` puesto en el número (saluda como Salón Bella, con nombre y «lo de
siempre»). Transferencia warm activa (persona y urgencias) hacia el móvil …373.

**Logo y portada de Salón Bella** (daban 404 porque apuntaban a imágenes borradas de cuando se
llamaba BENDITO ARTE):
- Logo neutro `public/img/salon-bella-logo.svg` y portada de salón de stock.
- La ficha `demo` se corrige sola al leerse tras el despliegue.

**Cómo probarlo tras el despliegue** (desde tu móvil al WhatsApp del negocio):
1. «Hola, soy Cristóbal. ¿Qué horas tenéis para una manicura el jueves?» → 2 horas reales. Contesta
   «la primera» → UN mensaje de cita guardada.
2. «Quiero un blanqueamiento dental el viernes a las 11» → no se hace, lista de servicios reales,
   nada en la agenda.
3. «Quiero hablar con una persona» → te llega el aviso al WhatsApp del dueño, que es tu móvil.

## Memoria de clienta (Pablo y Carmen) — EN PRODUCCIÓN (commit 3cd84ef, 30/09)

- **Qué recuerda:** va por negocio y por teléfono (`src/lib/memoria-clienta.ts`). Guarda:
  - su nombre y su idioma;
  - su franja preferida («prefiero por la tarde»);
  - las preferencias que dice ella («me gusta el esmalte nude»).

  De sus citas se calcula (no se duplica) lo siguiente:
  - sus últimos servicios con fecha;
  - «lo de siempre», es decir, el servicio que más repite y su profesional habitual.
- **Pablo:**
  - la saluda por su nombre;
  - si no dice qué quiere, propone «¿Lo de siempre, manicura con Ana?»;
  - al reservar ofrece primero su profesional y, si pide día sin hora, su franja.
- **Carmen:**
  - la ruta entrante ya da `{{cliente_nombre}}`, `{{lo_de_siempre}}` y `{{preferencias_cliente}}`;
  - agendar_cita entiende «lo de siempre»;
  - el prompt ya está en el repo, pero se publica al desplegar
    (`scripts/carmen-retell-publicar.mjs --publicar`). Hace falta poner en el número el
    *Inbound call webhook* `/api/carmen/entrante`.
- **Panel:** la ficha de cada clienta tiene el bloque «Memoria de Pablo y Carmen». La dueña
  puede corregir el nombre, la franja, el idioma y las preferencias, y tiene un botón
  «Olvidar a esta clienta».
- **RGPD:**
  - Nunca se guardan datos de salud: alergias, embarazo, medicación, enfermedades… Se
    descarta la frase entera, lo diga la clienta o lo escriba la dueña.
  - Si la clienta escribe «olvídame» o «borrad mis datos»:
    - se borra su memoria y la conversación guardada;
    - Pablo se lo confirma;
    - ya no se usa nada anterior.
  - Sus citas siguen en la agenda.
- **Pruebas:** `t15-memoria-resenas` y Playwright P12 (nombre, «lo de siempre», sin salud) y
  P13 (olvido).

## Reseña de Google al día siguiente — en producción, APAGADO

- **Cuándo se envía:**
  - al día siguiente de una cita **realizada**: completada, o confirmada que ya pasó;
  - nunca si fue anulada, no se presentó o estaba pendiente;
  - entre las 10 y las 20 h, desde el cron horario de recordatorios.
- **Contenido:** gracias y el enlace directo de Google del negocio. Es el campo nuevo
  «Enlace de reseñas de Google» de la ficha; sin enlace, no se envía nada.
- **Límites:** una petición por clienta cada **90 días**.
- **Si contesta con una queja:**
  - no se le insiste;
  - se avisa a la dueña por WhatsApp;
  - no se le vuelve a pedir en un año.
- **Plantilla:** `aiteam_pedir_resena` (es + en), solicitada a Meta como MARKETING (así
  clasifica Meta las peticiones de reseña).
  - Estado: **PENDING**.
  - Al aprobarse: `REVIEW_REQUEST_ENABLED=true` en Vercel. Ahora está apagado.
- **Pruebas:** `t15-memoria-resenas` (solo realizadas, 90 días, queja, sin enlace) y
  Playwright P14 (queja → aviso a la dueña).

## Lote de Pablo (30/09/2026) — en local, PENDIENTE de desplegar

Todo con envío simulado en las pruebas; en producción cada cosa detrás de su interruptor.

| Qué | Cómo funciona | Interruptor / plantilla |
|---|---|---|
| **Lista de espera** | Si la hora que pide está llena, Pablo ofrece apuntarla («apúntame» → queda en la lista con día y hora). Al anularse una cita se escribe **por orden** (quien se apuntó antes) a todas las de ese servicio, ese día y esa franja (mañana/tarde); la primera que dice «sí» se lo queda y a las demás se les avisa de que ya está cogido. La lista caduca el día del hueco. Reutiliza la FASE 2 (`booking-waitlist.ts`, `ofrecerALaLista` + `responderHuecoPorWhatsapp`). | `WAITLIST_SEND_ENABLED` (apagado) |
| **Pausar a Pablo** | Solo desde el `ownerWhatsapp`: «para con Laura / 600…» (hasta «sigue con…» o 24 h), «para todo» / «sigue», «mueve la cita de Laura al jueves a las 12» (pregunta y solo mueve con «sí»). En pausa, los mensajes se guardan en el panel sin contestar. Cualquier otro número que escriba eso es una clienta más. `pablo-dueno.ts` | — |
| **Cumpleaños** | Campo «Cumpleaños» (día y mes) en la ficha de la clienta. Ese día, entre 10 y 20 h, felicitación por WhatsApp, una vez al año. | `BIRTHDAY_ENABLED` (apagado) + `BIRTHDAY_TEMPLATE=aiteam_cumpleanos` (MARKETING, **PENDING** en Meta) |
| **Resumen diario** | 8:30: citas del día (hora, clienta, servicio, profesional), huecos libres por profesional y anulaciones de ayer, al WhatsApp de la dueña. | `DAILY_SUMMARY_ENABLED` (apagado) + `DAILY_SUMMARY_TEMPLATE=aiteam_resumen_diario` (UTILITY, **PENDING**) |
| **Citas en serie** | En cada servicio: «Sesiones del tratamiento» y «Cada cuántos días». Al reservar la 1ª, Pablo y Carmen reservan todas a la misma hora y con la misma profesional; si una fecha no tiene hueco, la más cercana, y se dice. `citas-en-serie.ts` | — |

**Crons nuevos (n8n, con CRON_SECRET, sin crear todavía):** `/api/cron/avisos-diarios?que=resumen`
a las 8:30 y `/api/cron/avisos-diarios?que=cumpleanos` a las 10:00 (hora de España).

**Pruebas:** `tests/unitarias/t16-lote-pablo.ts` (38 comprobaciones). Total: 16 suites y 30 recorridos
de Playwright.

## Marta (Instagram)

**Funciona** (según los recorridos de Playwright)
- Los DM llegan al panel y Marta contesta.
- Un comentario con la palabra clave dispara el DM automático.
- La publicación automática (`cron-marta-publicar-auto`) está activa en n8n.

**Falta**
- Esta tanda no ha tocado a Marta: no tiene prueba nueva ni cambio de identidad. En la
  cuenta propia sigue siendo la cuenta de AI-Team.

**Cómo probarlo**
- Recorridos 5 y 6 de Playwright.
