# Alta del número de WhatsApp de un cliente (caso Jose, gestoría)

Escrito el 23/09/2026, tras la aprobación de AI-Team como Tech Provider de Meta
(permiso `whatsapp_business_management`). Sirve para Jose y para cualquier
cliente siguiente. **Nada de esto está hecho todavía**: es la receta para el día
que Jose tenga su número. Lo que dice de los menús de Meta está sin probar: se
confirma el primer día.

Marca en cada paso quién lo hace: **[Jose]**, **[Cris]** o **[Claude Code]**
(lo puede hacer Claude Code por API o con las rutas de administración, sin que
tú toques nada).

## Qué es lo que hay que conseguir

Que un WhatsApp escrito al número de Jose llegue a Pablo **con el tenant de
Jose**, y no con el de AI-Team. Pablo lo decide así: Meta manda en cada mensaje
el identificador del número (`phone_number_id`) y `resolveTenantFromMeta`
(`src/lib/tenants.ts`) busca qué tenant lo tiene guardado en
`whatsappPhoneNumberId`. **Si no lo encuentra, Pablo se calla** (a propósito: es
mejor callar que contestar por la cuenta equivocada; en el log sale
`[tenants] SIN DUEÑO`).

Hacen falta dos datos que solo salen del alta en Meta:

| Dato | Qué es | Dónde se guarda |
|---|---|---|
| `phone_number_id` | El identificador del número (NO es el teléfono, es un número largo de Meta) | `whatsappPhoneNumberId` del tenant |
| `waba_id` | La cuenta de WhatsApp Business a la que pertenece ese número | `whatsappBusinessAccountId` del tenant |

## Antes de empezar (lo que tiene que cumplir el número)

- **[Jose]** El número no puede estar dado de alta a la vez en la app normal de
  WhatsApp o WhatsApp Business del móvil: para usarlo con la API hay que
  darlo de baja allí antes (o usar una SIM nueva, que es lo más limpio). Es una
  condición de Meta y no se salta.
- **[Jose]** Tiene que poder recibir un SMS o una llamada en ese número: Meta
  verifica con un código.
- **[Jose]** Necesita una cuenta de Facebook con permiso de administrador sobre
  el "Business Manager" de su gestoría (si no tiene, se crea en el propio
  proceso).

## Paso 1 — El registro en Meta: el enlace alojado por Meta (camino principal)

**No hace falta construir ninguna pantalla.** Meta ofrece una página de registro
alojada por ellos (*Registro insertado alojado por Meta*, en inglés *Hosted
Embedded Signup*). Se genera desde el panel de Meta y se le manda a Jose por
WhatsApp o correo.

**[Cris] — generar el enlace (una vez):**

1. En el panel de desarrolladores de Meta, abrir la app **AI-Team Publisher**.
2. Ir al **caso de uso de WhatsApp** (*Casos de uso → WhatsApp → Personalizar*)
   y buscar el apartado **"Registro insertado alojado por Meta"**.
3. Pulsar **"Generar enlace"**. Meta devuelve una URL de registro alojada por
   ellos. Ese es el enlace que se le manda a Jose.
4. Copiar el enlace y mandárselo a Jose. No lleva ninguna clave dentro.

> Los nombres exactos de los menús de Meta cambian con frecuencia: si algo no se
> llama así, buscar por la idea (*registro insertado*, *hosted*, *generar
> enlace*).

**[Jose] — lo que hace con el enlace:**

1. Abre el enlace e inicia sesión con su Facebook.
2. Elige o crea la cuenta de empresa de su gestoría.
3. Crea su cuenta de WhatsApp Business y escribe el número nuevo.
4. Mete el código que Meta le manda por SMS o llamada a ese número.
5. Termina. Meta le deja la cuenta creada y con su número conectado.

Al acabar, la cuenta de Jose debería quedar **compartida con AI-Team** como Tech
Provider (comprobarlo el primer día en WhatsApp Manager). De ahí salen los dos
datos del paso 2.

**Lo que tiene que cumplir el número** (condición de Meta, no se salta):

- No puede estar activo a la vez en la app normal de WhatsApp o WhatsApp
  Business del móvil: hay que darlo de baja allí antes, o usar una SIM nueva, que
  es lo más limpio.
- Tiene que poder recibir un SMS o una llamada.
- Jose necesita una cuenta de Facebook con permiso de administrador sobre el
  Business Manager de su gestoría (si no tiene, se crea en el propio proceso).

**Más adelante (no es urgente):** una pantalla propia dentro de aiteam.marketing
con el botón "Conectar mi WhatsApp" que abra el registro insertado y guarde los
dos datos sin copiarlos a mano. Es trabajo de [Claude Code] y necesita el
`config_id` del panel de Meta. Con el enlace alojado no hace falta hasta que haya
muchos clientes.

**Si el enlace alojado no se pudiera usar**, queda el camino a mano: **[Jose]**
crea su cuenta de WhatsApp Business en `business.facebook.com` → WhatsApp
Manager, añade su número y la comparte con la empresa de AI-Team dándole acceso
de administración (en Meta se llama "añadir un socio").

## Paso 2 — Recoger los dos datos

- Cuando Jose termina el enlace de Meta: **[Cris]** en WhatsApp Manager → "Números de teléfono": el
  identificador del número aparece junto al teléfono (*ID del número de
  teléfono*), y el de la cuenta arriba (*ID de la cuenta de WhatsApp Business*).
  **[Claude Code]** también puede listarlos por API con el token de AI-Team:
  `GET /{waba_id}/phone_numbers`.

No hace falta pegarlos en el chat: van a la URL del paso 3.

## Paso 3 — Asignarlos al tenant de Jose

**[Cris]** abre esta dirección con la sesión de fundador (o **[Claude Code]** lo
hace por él):

```
https://aiteam.marketing/api/admin/tenant-whatsapp-numero?tenant=<TENANT_DE_JOSE>&numero=<phone_number_id>&waba=<waba_id>
```

- Sin parámetros, la misma dirección **lista** qué tenant tiene qué número.
- Si ese número ya es de otro tenant, **no cambia nada** y contesta 409.
- La cuenta propia de AI-Team (`tenant_aiteam`) no se toca desde ahí.
- Para deshacerlo: `…?tenant=<TENANT_DE_JOSE>&quitar=1`.

`<TENANT_DE_JOSE>` es `tenant_demo_gestoria` mientras sea la demo; el día que
Jose sea cliente de verdad tendrá su propio tenant y ese será el id.

## Paso 4 — Registrar el número en Cloud API

Solo si Meta lo pide (el número aparece como no conectado). Es
`POST /{phone_number_id}/register` con un **PIN de 6 cifras que elige Jose**.
**[Claude Code]** lo puede hacer por API, pero el PIN lo dice Jose: nunca se
inventa ni se prueba a ciegas, porque tras varios fallos Meta bloquea el
registro.

## Paso 5 — Suscribir la app a la cuenta de Jose (el que se olvida)

La suscripción es **de la app a cada WABA por separado** y no se hereda. Sin
ella, Meta no manda ni un mensaje al webhook y todo parece bien.
**[Claude Code]** lo hace, con el token en el entorno, nunca en el chat:

```bash
WHATSAPP_BUSINESS_ACCOUNT_ID=<waba_id> WHATSAPP_PHONE_NUMBER_ID=<phone_number_id> \
  node scripts/whatsapp-waba.mjs --estado      # ¿está suscrita?
WHATSAPP_BUSINESS_ACCOUNT_ID=<waba_id> WHATSAPP_PHONE_NUMBER_ID=<phone_number_id> \
  node scripts/whatsapp-waba.mjs --suscribir   # suscribir y comprobar
```

El script ya existe (no imprime el token nunca). Equivale a
`POST /{waba_id}/subscribed_apps`. **Duda a comprobar el primer día:** con
cuentas de clientes, el token que sirve puede ser el de la empresa de AI-Team
como Tech Provider o uno que devuelve el propio registro insertado; el script
dirá `código 200/10` si el token no tiene permiso sobre esa cuenta.

## Paso 6 — Plantillas (cuando se vayan a encender avisos)

Las plantillas se aprueban **por cuenta**: las de AI-Team no valen en la de Jose.
Las que usa el código de gestoría son `gestoria_falta_factura` (5 variables:
cliente, gestoría, fecha, importe, concepto) y `aviso_dueno_cita`. **[Claude
Code]** puede crearlas por API (`POST /{waba_id}/message_templates`); Meta tarda
en aprobarlas. Sin plantilla aprobada, el envío fuera de las 24 h no sale y el
panel lo dice.

## Paso 7 — Probar sin riesgo

1. `GET /api/admin/tenants-meta` (solo fundador): el tenant de Jose debe salir
   con su `whatsappPhoneNumberId` y sin avisos de repetidos.
2. **[Jose o Cris]** manda un WhatsApp al número nuevo desde otro móvil. Debe
   contestar Pablo con el tono de la gestoría. Si no contesta: log de Vercel,
   buscar `SIN DUEÑO` (paso 3 mal) o comprobar el paso 5 (suscripción).
3. Con Pablo funcionando, pedir una foto de factura: debe entrar en
   `/dashboard/facturas` de Jose (ver el desvío en `/api/admin/gestoria-desvio`
   mientras no tenga número propio).

## Paso 8 — Encender los avisos, uno a uno

Todos los interruptores de gestoría están **apagados** y así deben seguir hasta
que el número esté probado. Se encienden de uno en uno en Vercel (producción) y
hay que volver a desplegar, porque Vercel congela las variables en cada
despliegue:

| Variable | Qué hace al encenderse |
|---|---|
| `GESTORIA_AVISO_DIARIO_ENABLED` | Cada mañana, resumen y vencimientos al WhatsApp de Jose |
| `GESTORIA_ENVIO_DOCS_ENABLED` | Mandar a un cliente un documento que Jose ha elegido |
| `GESTORIA_DOCS_SEND_ENABLED` | Reclamar por WhatsApp a los clientes los documentos que faltan |
| `GESTORIA_FISCAL_SEND_ENABLED` | Avisos de vencimientos del calendario fiscal a los clientes |
| `GESTORIA_RECLAMACION_SEND_ENABLED` | Pedir al cliente una factura que falta (por plantilla) |

Antes de encender **cualquiera**, poner el WhatsApp de Jose (paso 9) y confirmar
que los clientes que tiene la gestoría son reales y han dado su consentimiento.
Los clientes de la demo tienen teléfonos de mentira (prefijo `099`) y **el envío
los bloquea siempre**, estén los interruptores como estén.

## Paso 9 — El WhatsApp del dueño (a quien van los avisos)

```
https://aiteam.marketing/api/admin/tenant-owner-whatsapp?tenant=<TENANT_DE_JOSE>&numero=<34XXXXXXXXX>
```

Dígitos con prefijo de país, sin `+`. Es el móvil personal de Jose, distinto del
número nuevo de la gestoría. La ruta nunca devuelve el número entero.
`…&quitar=1` lo borra. Poner el número no manda nada por sí solo.

## Resumen: qué hace cada uno

| Paso | Quién |
|---|---|
| 1 Registro en Meta | Cris genera el enlace y se lo manda; Jose lo completa |
| 2–3 Recoger y asignar ids | Cris abre la URL, o [Claude Code] |
| 4 Registrar número (PIN) | [Claude Code] con el PIN que dé Jose |
| 5 Suscribir la app a su cuenta | [Claude Code] |
| 6 Plantillas | [Claude Code] crea, Meta aprueba |
| 7 Probar | Cris/Jose |
| 8–9 Encender avisos y poner su móvil | Cris, uno a uno |
