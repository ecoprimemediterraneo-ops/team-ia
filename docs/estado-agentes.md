# Estado de los agentes: Carmen, Pablo y Marta (29/09/2026)

«En producción» es lo que está funcionando en aiteam.marketing y en Retell ahora.
«En local» es código probado en verde, **pendiente de desplegar**.

## Carmen (voz, Retell, +34 951 870 605)

**Funciona en producción**
- Atiende como **Salón Bella** (el negocio de agenda `demo` de la cuenta propia), con
  dirección, horario y servicios de su ficha. Se presenta como asistente virtual.
  Es la **versión 6 de CARMEN v2**, publicada.
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

**Funciona en producción**
- Reserva con huecos reales, cambia y cancela por WhatsApp.
- Los recordatorios del día antes salen una sola vez.
- La cita aparece en el panel en vivo.
- Si Pablo y Carmen piden el mismo hueco a la vez, entra una sola.
- Las confirmaciones y recordatorios salen con las plantillas aprobadas y el nombre de la
  ficha del negocio. Desde el 29/09 la ficha `demo` se llama **Salón Bella**; antes decía
  «BENDITO ARTE».

**En local (pendiente de desplegar)**
- En la cuenta propia (`tenant_aiteam`, con `negocioAgenda=demo`), Pablo deja la persona
  comercial de AI-Team y atiende como Salón Bella, con nombre, dirección, horario y
  servicios con precio sacados de la ficha. También agenda citas.
- **Ojo:** al desplegar, el WhatsApp de la cuenta propia dejará de contestar como
  comercial de AI-Team.

**Falta**
- Desplegar.
- El negocio `bendito-arte` sigue dado de alta en la cuenta propia (semilla del salón
  fundador): sus propias citas, si las hay, seguirán diciendo «Bendito Arte», que es lo
  correcto para ese negocio.
- Revisar el logo y la portada de la ficha `demo`: se subieron cuando se llamaba BENDITO
  ARTE y desde fuera del panel no se pueden ver.

**Cómo probarlo**
- Recorridos 1, 3 y 4 de Playwright.
- `t5-salon-chat` y `t12-carmen-cierre` (identidad).
- Tras desplegar: escribir al WhatsApp de la cuenta propia «hola, ¿qué horario tenéis?» y
  comprobar que contesta como Salón Bella.

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
