export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  author: string;
  category: string;
  readingTime: string;
  body: string;
};

export const posts: BlogPost[] = [
  {
    slug: "whatsapp-business-pyme-2026",
    title: "Cómo automatizar WhatsApp Business en una PYME sin volverse loco",
    excerpt:
      "El 87% de los clientes que escriben a una PYME por WhatsApp esperan respuesta en menos de 10 minutos. Te contamos cómo cubrir esa ventana sin contratar a nadie.",
    date: "2026-05-05",
    author: "AI-Team",
    category: "WhatsApp",
    readingTime: "5 min",
    body: `## El problema real

Una clínica dental media recibe entre 30 y 80 mensajes de WhatsApp al día. Una peluquería de barrio, entre 40 y 120. Una clínica estética, fácilmente más de 150 en temporada alta.

El problema no es responderlos. El problema es responderlos **en menos de 10 minutos**, que es la ventana en la que un cliente sigue interesado antes de irse a la competencia.

## Por qué fallan los bots tradicionales

Los chatbots clásicos basados en árboles de decisión funcionan en menos del 30% de las conversaciones reales. La gente escribe como habla, no como un formulario.

Un agente IA bien afinado (con tu catálogo, precios y agenda como contexto) supera el 85% de resolución sin intervención humana — y deriva al humano sin fricción cuando no sabe.

## Las tres reglas que sí funcionan

1. **Contexto completo desde el primer mensaje.** El agente tiene que saber qué vendes, a qué precio y con qué disponibilidad. Sin eso es un loro caro.
2. **Confirmación al humano antes de cerrar.** Cita propuesta, no cita confirmada. Tú apruebas, el agente cierra.
3. **Resumen diario, no notificación por mensaje.** Si tu móvil vibra 80 veces al día, vas a apagar el sistema en una semana.

## Lo que medimos en nuestros pilotos

- Tiempo medio de respuesta: de 47 min → 8 seg.
- Tasa de conversión lead → cita: +34%.
- Pérdida por mensajes ignorados fuera de horario: -91%.

Pablo, nuestro agente de WhatsApp, está operativo en modo asistido. Activación real (auto-respuesta 24/7) tras alta en Meta Business.`,
  },
  {
    slug: "resenas-google-clinica-dental",
    title: "Reseñas Google para clínicas dentales: el sistema que multiplica por 4 las reseñas mensuales",
    excerpt:
      "Pedir reseñas funciona. Pedirlas en el momento exacto, con el canal correcto y respondiendo al 100% — funciona 4x más. Sistema completo aquí.",
    date: "2026-04-28",
    author: "AI-Team",
    category: "Reseñas Google",
    readingTime: "6 min",
    body: `## Por qué las reseñas mueven la aguja (en serio)

El 93% de los pacientes leen reseñas antes de elegir clínica. El segundo factor de decisión, después del precio, es el número de reseñas recientes (últimos 90 días) por encima de 4 estrellas.

Una clínica con 80 reseñas y 4,7 estrellas recibe **3 veces más visitas a su ficha de Google** que una con 20 reseñas y 4,9 — porque Google premia volumen + recencia, no solo nota.

## El error típico

Pedir reseñas "a quien parezca contento" después de la cita. Conversión: 8-12%.

El sistema que multiplica eso por 4:

1. **Solicitud automática 30-60 min después de salir.** No al día siguiente. El recuerdo positivo se enfría rápido.
2. **Enlace directo a Google (no a un formulario interno).** Cada paso intermedio pierde 40% de conversiones.
3. **Mensaje personalizado con el nombre y el tratamiento.** No "danos tu opinión", sino "¿cómo fue tu limpieza de hoy, María?".
4. **Respuesta a TODAS las reseñas en menos de 24h.** Las buenas y las malas. Google lo premia y los siguientes pacientes lo leen.

## Cómo lo automatiza Rocío

Rocío conecta con tu agenda (Google Calendar / Doctoralia / Apple Calendar) y dispara la solicitud automáticamente. Las respuestas a reseñas las genera con el tono de tu clínica y te las propone para aprobar (o aprobación automática si activas modo autónomo).

Resultado medio en los pilotos: de 4-6 reseñas/mes → 18-24 reseñas/mes en el segundo mes.`,
  },
  {
    slug: "email-marketing-pyme-resend",
    title: "Email marketing para PYMES: por qué Mailchimp es caro y cómo montar lo mismo por 0€",
    excerpt:
      "Mailchimp cobra 89€/mes a partir de 2.500 contactos. Resend + un agente IA hace lo mismo (y mejor) por una fracción del precio.",
    date: "2026-04-20",
    author: "AI-Team",
    category: "Email Marketing",
    readingTime: "4 min",
    body: `## El problema con las plataformas legacy

Mailchimp, ActiveCampaign, Klaviyo… todas cobran por contacto. A partir de 2.500 contactos pagas 89€/mes. A partir de 10.000, más de 200€.

Y para lo que la PYME media necesita (newsletter semanal + secuencia de bienvenida + campaña ocasional), pagas por 90% de features que no usas.

## La pila moderna (2026)

- **Resend** (3.000 emails/mes gratis, después 20$/50k) — entregabilidad de primer nivel.
- **Agente IA** para redactar (tono, asunto, copy, segmentación).
- **Lista de contactos en tu CRM o spreadsheet** — sin lock-in.

Diferencia mensual real para un negocio de 5.000 contactos: ~85€/mes.

## Lo que nadie te cuenta sobre entregabilidad

Si no configuras SPF + DKIM + DMARC en tu dominio, tus emails van directos a spam. Esto no es opcional desde febrero de 2024 (Gmail y Yahoo lo hacen obligatorio).

Eva (nuestro agente de email marketing) configura los tres registros DNS contigo en el onboarding. Sin eso, no enviamos.

## Resultados medios

- Tasa de apertura: 32-41% (la media del sector está en 21%).
- Click-through: 4-7%.
- Coste por envío: 0,0004€ vs 0,012€ de plataformas legacy.

Eva está operativa con envíos reales desde \`eva@aiteam.marketing\` o desde tu propio dominio.`,
  },
];

posts.push(
  {
    slug: "agentes-ia-vs-empleados-pyme",
    title: "Agentes IA vs. empleados: cuánto cuesta de verdad cada opción para una PYME",
    excerpt:
      "Sumar nómina + Seguridad Social + bajas + onboarding sale por ~3.200€/mes el primer año. Comparativa real con agentes IA — y dónde NO sustituir.",
    date: "2026-04-12",
    author: "AI-Team",
    category: "Estrategia",
    readingTime: "7 min",
    body: `## El cálculo que nadie hace

Un empleado a jornada completa en España con salario bruto de 1.800€/mes le cuesta a la empresa ~2.350€ (Seguridad Social a cargo del empresario, pagas extras prorrateadas). Sumando vacaciones, bajas medias del sector, formación y rotación, el coste real del primer año oscila entre 3.000 y 3.400€/mes.

Y eso es por **una persona, cubriendo 8h, 5 días a la semana**.

## Lo que cubre un equipo IA por 249€/mes (plan Élite)

- WhatsApp 24/7 (Pablo)
- Llamadas entrantes (Carmen)
- Reseñas Google (Rocío)
- Correo y agenda (Lucía)
- Redes sociales (Marta)
- Email marketing (Eva)

No es comparable 1:1 con un empleado, pero **cubre seis canales que ningún empleado solo puede cubrir simultáneamente**.

## Dónde NO sustituir

Hay cosas que un agente IA hace mal hoy:

- Trato presencial con cliente difícil
- Negociación con proveedor en vivo
- Resolución de incidencias técnicas físicas
- Decisiones estratégicas con datos ambiguos

La PYME bien montada en 2026 tiene **un equipo humano más pequeño, mejor pagado y más estratégico** — apoyado por agentes que cubren la operativa repetitiva.

## El cálculo final

| Concepto | Empleado | AI-Team Élite |
|---|---|---|
| Coste mensual | 3.200€ | 249€ |
| Horas cubiertas | 40h/sem | 168h/sem |
| Canales atendidos | 1-2 | 6 |
| Vacaciones / bajas | Sí | No |

No reemplaza a una persona buena. Reemplaza al "lo hago yo cuando pueda".`,
  },
  {
    slug: "automatizar-instagram-pequeno-negocio",
    title: "Cómo automatizar Instagram para un negocio local sin perder autenticidad",
    excerpt:
      "Publicar 3 veces por semana con tu voz, sin contratar agencia ni quemarte. El sistema que usan nuestros pilotos para sostener IG sin fricción.",
    date: "2026-04-03",
    author: "AI-Team",
    category: "Redes Sociales",
    readingTime: "5 min",
    body: `## El problema con "automatizar Instagram"

La mayoría de las herramientas que prometen automatizar IG generan contenido genérico que el algoritmo penaliza y los seguidores ignoran. El resultado típico: 3 meses publicando, 2% de engagement, abandono.

## Lo que sí funciona

1. **Voz aprendida, no genérica.** El agente analiza tus últimos 50 posts (los que tuvieron mejor engagement) y replica patrones: longitud, emojis, llamadas a la acción, tono.
2. **Calendario editorial mensual.** No reactivo. Marta propone un calendario al inicio del mes con temas, formatos (carrusel, reel, foto) y fechas óptimas según tu sector.
3. **Aprobación humana antes de publicar.** Siempre. Sin excepción. Es la diferencia entre "tu marca con IA detrás" y "una agencia barata".

## Frecuencia recomendada por sector

- **Clínica dental:** 3 posts/sem + 1 reel/sem
- **Peluquería:** 5 posts/sem (alta frecuencia visual)
- **Restaurante:** 4 posts/sem + stories diarias
- **Servicio profesional (abogado, consultor):** 2 posts/sem + 1 carrusel educativo/sem

## Lo que medimos en pilotos

- Engagement medio: 4,8% (vs 1,2% sector PYME)
- Tiempo del propietario en redes: de 5h/semana → 25 min de revisión
- Crecimiento de seguidores: +18% en 90 días`,
  },
  {
    slug: "inteligencia-competitiva-pyme-sergio",
    title: "Inteligencia competitiva para PYMES: vigilar a tu competencia sin obsesionarte",
    excerpt:
      "Saber qué hacen tus competidores te ayuda a posicionarte. Obsesionarte te paraliza. El equilibrio con un sistema de alertas automatizado.",
    date: "2026-03-25",
    author: "AI-Team",
    category: "Inteligencia Competitiva",
    readingTime: "5 min",
    body: `## Por qué la mayoría de PYMES no vigila a su competencia

Por tiempo. Punto. No por filosofía ni por miedo. Simplemente, cuando llevas una clínica, no tienes 2h al día para mirar webs ajenas.

El resultado: te enteras de que el competidor de al lado bajó precios cuando un cliente te lo dice en la silla.

## Qué vigila Sergio (sin obsesionar)

- **Precios públicos en su web.** Si cambia, alerta.
- **Promos en redes sociales y Google Ads.** Si lanza una, alerta.
- **Reseñas nuevas y nota agregada.** Comparación semanal.
- **Cambios en horarios, ubicaciones o servicios.** Si abre nueva sede, alerta.

## Qué NO hace (y por qué)

No replica precios automáticamente. No genera ataques. No te manda 14 notificaciones al día.

**Un solo informe a las 7:00 de la mañana** con lo relevante de las últimas 24h. Si no hay nada relevante, no llega el email. Esto es clave: la fatiga de alertas mata el sistema más rápido que cualquier otra cosa.

## El ratio que funciona

Por cada 10 cambios detectados, 1-2 ameritan reacción tuya. Sergio te dice cuáles y por qué — el resto los archiva para el informe semanal.`,
  },
  {
    slug: "llamadas-perdidas-recepcionista-ia",
    title: "Cada llamada perdida te cuesta 47€: el caso de la recepcionista IA",
    excerpt:
      "El 67% de los clientes que llaman a una PYME y no obtienen respuesta llaman al siguiente competidor. Carmen contesta al segundo tono — incluso a las 22:00.",
    date: "2026-03-18",
    author: "AI-Team",
    category: "Llamadas",
    readingTime: "4 min",
    body: `## El número que duele

Promedio en clínica dental: 47€ de valor por primera cita. Promedio de llamadas perdidas en hora punta: 3-7 al día. Pérdida potencial mensual: 2.800-6.500€.

Y esto es solo el corto plazo — un paciente perdido se traduce en ~600€ de valor a 5 años.

## Por qué nadie lo arregla

Porque contratar a una recepcionista cuesta ~2.500€/mes y cubre solo 8h. Las llamadas perdidas son sobre todo a primera hora, al mediodía y por la noche — fuera de su horario.

## Lo que hace Carmen

- Contesta al segundo tono, 24/7, en español natural.
- Conoce tu catálogo, tus precios y tu agenda.
- Cierra cita en Google Calendar / Doctoralia automáticamente.
- Si la llamada requiere humano, deriva con resumen al equipo.

## El ratio en los pilotos

- Tasa de atención de llamadas: 100% (vs 67% sin Carmen)
- Citas cerradas en primera llamada: +41%
- Coste vs recepcionista: 50-90€/mes (Vapi) vs 2.500€/mes`,
  },
  {
    slug: "spf-dkim-dmarc-pyme-resend",
    title: "SPF, DKIM y DMARC explicados para PYMES: por qué tus emails caen en spam",
    excerpt:
      "Desde 2024 Gmail y Yahoo exigen los 3 registros DNS. Si no los tienes, tus correos van directos a spam. Guía paso a paso.",
    date: "2026-03-10",
    author: "AI-Team",
    category: "Email Marketing",
    readingTime: "6 min",
    body: `## El cambio de febrero de 2024 que nadie te contó

Google y Yahoo pasaron a exigir SPF, DKIM y DMARC para cualquier remitente que envíe más de 5.000 emails/día. Pero en la práctica, su algoritmo penaliza también a remitentes pequeños sin los tres registros.

Si los emails de tu PYME van a spam, esta es la primera causa.

## Qué es cada uno (en cristiano)

- **SPF**: dice qué servidores pueden enviar emails en nombre de tu dominio.
- **DKIM**: firma criptográfica que demuestra que el email no se ha manipulado.
- **DMARC**: política que indica qué hacer si SPF/DKIM fallan (rechazar, marcar como spam, etc.).

Los tres son **registros DNS de tipo TXT** que añades en tu proveedor de dominio (Namecheap, GoDaddy, Cloudflare, etc.).

## Cómo configurarlos con Resend

1. En Resend → Domains → Add domain → introduces \`tudominio.com\`.
2. Resend te da 3 registros TXT y opcionalmente 1 MX.
3. Los pegas en tu proveedor de DNS.
4. Esperas la verificación (5 min a 24h según proveedor).

## Cómo lo automatiza Eva

En el onboarding de Eva configuramos los 3 registros contigo — incluyendo el DMARC, que es el que más se olvida. Sin esto, no enviamos.

Coste: 0€. Diferencia en tasa de apertura: del 8-12% al 32-41%.`,
  },
);

export const postBySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
