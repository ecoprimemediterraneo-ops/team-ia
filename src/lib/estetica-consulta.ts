// Preguntarle al panel de la clínica estética en lenguaje normal — mismo
// criterio que `dental-consulta.ts`: el modelo NO recibe la base de datos
// entera, recibe unas pocas funciones de consulta y las llama. Si solo puede
// ver lo que esas funciones devuelven, no puede inventarse un lead que no
// existe.
//
// Y también ESCRIBE, con la MISMA regla: nada a la primera. Las herramientas
// "preparar_…" no cambian nada — devuelven una propuesta ({resumen, accion})
// que se guarda en el turno del chat, y solo se ejecuta cuando se confirma
// explícitamente (ver `estetica-acciones.ts` y el `body.confirmar` de
// `/api/estetica/preguntar`).

import { esPegaDeHora, calendarioProximo } from "./hueco-panel";
import "server-only";
import { sinInventar, pideConfirmarEnTexto, NUDGE } from "./chat-honesto";
import { anthropic, MODELS } from "./claude";
import {
  getBusinessesForTenant,
  listRecordsForRange,
  computeFreeSlots,
  resolverServicio,
  type BookingRecord,
} from "./booking";
import {
  listarLeads,
  leadsCalientesSinContestar,
  ETIQUETA_ESTADO,
  diasAbierto,
  type EstadoLead,
  type Lead,
} from "./estetica-leads";
import {
  prepararCrearCita,
  prepararCrearLead,
  prepararCambiarEstadoLead,
  type AccionPendiente,
} from "./estetica-acciones";

export type Accion = { texto: string; href: string };
export type Respuesta = {
  texto: string;
  acciones: Accion[];
  /** Lo que el chat propone hacer y espera un sí. Solo el ÚLTIMO turno lo pinta. */
  pendiente?: { resumen: string; accion: AccionPendiente } | null;
};

function hoyISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
}
const hora = (iso: string) => iso.match(/T(\d{2}:\d{2})/)?.[1] ?? iso;
const fechaNatural = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

const comoSeLlama = (l: Lead) =>
  l.nombre || (l.instagram ? `@${l.instagram.replace(/^@/, "")}` : l.telefono) || "sin nombre";

const HERRAMIENTAS = [
  {
    name: "citas_del_dia",
    description: "Las citas y valoraciones de un día concreto: hora, persona y tratamiento. Si no se da fecha, hoy.",
    input_schema: {
      type: "object" as const,
      properties: { fecha: { type: "string", description: "AAAA-MM-DD. Si se omite, hoy." } },
    },
  },
  {
    name: "huecos_libres",
    description: "Huecos libres de un día, calculados con la duración del tratamiento más habitual. Si no se da fecha, hoy.",
    input_schema: {
      type: "object" as const,
      properties: { fecha: { type: "string", description: "AAAA-MM-DD. Si se omite, hoy." } },
    },
  },
  {
    name: "leads_calientes_sin_contestar",
    description:
      "Quién ha preguntado con interés real y TODAVÍA no ha recibido respuesta. Úsala con '¿a quién tengo que contestar?', '¿hay algo urgente?' o '¿quién está pendiente?'.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "leads",
    description:
      "La cola de leads, opcionalmente filtrada por estado (nuevo, contactado, cita_puesta, descartado). Sin filtro, los últimos.",
    input_schema: {
      type: "object" as const,
      properties: {
        estado: { type: "string", enum: ["nuevo", "contactado", "cita_puesta", "descartado"] },
      },
    },
  },

  // --- ACCIONES: estas CAMBIAN datos ---------------------------------------
  // Ninguna ejecuta nada. Todas PREPARAN y devuelven una propuesta que hay que
  // aprobar. Ver `estetica-acciones.ts` para el porqué.
  {
    name: "preparar_crear_cita",
    description:
      "PREPARA crear una cita o valoración nueva. No la crea: devuelve una propuesta para que la dueña la apruebe. Necesitas nombre, tratamiento, fecha y hora. Si falta alguno, PREGÚNTALO en vez de llamar a la herramienta a medias.",
    input_schema: {
      type: "object" as const,
      properties: {
        nombre: { type: "string", description: "Nombre de la persona." },
        telefono: { type: "string", description: "Teléfono, si lo dan." },
        tratamiento: { type: "string", description: "Qué se le va a hacer o valorar: 'valoración', 'láser facial'…" },
        fecha: { type: "string", description: "AAAA-MM-DD." },
        hora: { type: "string", description: "HH:mm, 24 horas." },
      },
      required: ["nombre", "tratamiento", "fecha", "hora"],
    },
  },
  {
    name: "preparar_crear_lead",
    description:
      "PREPARA apuntar un lead nuevo a mano. No lo apunta: devuelve una propuesta. Necesitas el nombre y, ADEMÁS, el teléfono o el @usuario de Instagram (sin una de las dos cosas no hay forma de contestarle: PREGÚNTALO).",
    input_schema: {
      type: "object" as const,
      properties: {
        nombre: { type: "string" },
        telefono: { type: "string" },
        instagram: { type: "string", description: "@usuario de Instagram, sin la arroba." },
        tratamientoInteres: { type: "string", description: "Qué tratamiento le interesa." },
        caliente: { type: "boolean", description: "true si hay tratamiento concreto y plazo cercano." },
        motivoCaliente: { type: "string", description: "Por qué está caliente, en una frase." },
      },
      required: ["nombre"],
    },
  },
  {
    name: "preparar_cambiar_estado_lead",
    description:
      "PREPARA mover un lead de estado. Úsala con 'a Ana ya la he llamado' (contactado), 'Ana ya tiene la valoración puesta' (cita_puesta) o 'descarta a Ana' (descartado).",
    input_schema: {
      type: "object" as const,
      properties: {
        quien: { type: "string", description: "Nombre, teléfono o @usuario del lead." },
        estado: { type: "string", enum: ["nuevo", "contactado", "cita_puesta", "descartado"] },
      },
      required: ["quien", "estado"],
    },
  },
] as const;

type Args = Record<string, unknown>;

/** Lo que una herramienta le devuelve al modelo, más la acción si la preparó. */
type SalidaHerramienta = { texto: string; propuesta?: { resumen: string; accion: AccionPendiente }; bloqueo?: string };

const str = (args: Args, k: string): string | undefined => {
  const v = args[k];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};
const bool = (args: Args, k: string): boolean | undefined => {
  const v = args[k];
  return typeof v === "boolean" ? v : undefined;
};

const ES_ESTADO = (s: string | undefined): s is EstadoLead =>
  s === "nuevo" || s === "contactado" || s === "cita_puesta" || s === "descartado";

/**
 * Las acciones se preparan aquí y NO se ejecutan. Devuelven al modelo una
 * frase para que se la lea a la dueña, y aparte la acción ya resuelta, que se
 * guarda para cuando confirme. El modelo nunca toca los datos: como mucho,
 * propone.
 */
async function prepararAccion(tenantId: string, nombre: string, args: Args): Promise<SalidaHerramienta | null> {
  let r: import("./estetica-acciones").Preparada | null = null;
  if (nombre === "preparar_crear_cita") {
    r = await prepararCrearCita(tenantId, {
      nombre: str(args, "nombre"), telefono: str(args, "telefono"),
      tratamiento: str(args, "tratamiento"), fecha: str(args, "fecha"), hora: str(args, "hora"),
    });
  } else if (nombre === "preparar_crear_lead") {
    r = await prepararCrearLead(tenantId, {
      nombre: str(args, "nombre"), telefono: str(args, "telefono"), instagram: str(args, "instagram"),
      tratamientoInteres: str(args, "tratamientoInteres"),
      caliente: bool(args, "caliente"), motivoCaliente: str(args, "motivoCaliente"),
    });
  } else if (nombre === "preparar_cambiar_estado_lead") {
    const estado = str(args, "estado");
    if (!ES_ESTADO(estado)) {
      return { texto: "El estado tiene que ser 'nuevo', 'contactado', 'cita_puesta' o 'descartado'." };
    }
    r = await prepararCambiarEstadoLead(tenantId, str(args, "quien") ?? "", estado);
  } else {
    return null;
  }

  if (r.tipo === "propuesta") {
    return {
      texto: `PROPUESTA LISTA. Dile a la dueña exactamente esto y pídele que confirme: "${r.resumen}". No digas que ya está hecho: no lo está hasta que confirme.`,
      propuesta: { resumen: r.resumen, accion: r.accion },
    };
  }
  if (r.tipo === "ambiguo") {
    return { texto: `NO ESTÁ CLARO A QUIÉN SE REFIERE. Pregúntaselo: ${r.pregunta}\nOpciones:\n- ${r.opciones.join("\n- ")}` };
  }
  return { texto: `NO SE PUEDE: ${r.motivo}`, ...(esPegaDeHora(r.motivo) ? { bloqueo: r.motivo } : {}) };
}

async function ejecutarConsulta(tenantId: string, nombre: string, args: Args): Promise<string> {
  const negocios = await getBusinessesForTenant(tenantId);
  const negocio = negocios[0];

  if (nombre === "citas_del_dia") {
    if (!negocio) return "No hay ninguna agenda conectada todavía.";
    const fecha = (typeof args.fecha === "string" && args.fecha) || hoyISO();
    const citas = (await listRecordsForRange(negocio.slug, fecha, fecha)).filter(
      (r) => r.tipo === "cita" && (r.estado === "pendiente" || r.estado === "confirmada"),
    );
    if (citas.length === 0) return `Sin citas el ${fechaNatural(fecha)}.`;
    return citas
      .map((r: BookingRecord) => `${hora(r.startIso)} — ${r.cliente.nombre || "sin nombre"} (${[r.servicioNombre, r.varianteNombre].filter(Boolean).join(" · ")}) [${r.estado}]`)
      .join("\n");
  }

  if (nombre === "huecos_libres") {
    if (!negocio) return "No hay ninguna agenda conectada todavía.";
    const servicio = negocio.servicios.find((s) => s.activo);
    if (!servicio) return "Todavía no hay ningún tratamiento configurado, así que no se pueden calcular huecos.";
    const fecha = (typeof args.fecha === "string" && args.fecha) || hoyISO();
    const sel = resolverServicio(servicio, {});
    const r = await computeFreeSlots(negocio, sel, fecha, "https://aiteam.marketing/api/lucia/callback");
    if (!r.ok) return `No se ha podido consultar la agenda: ${r.detail}`;
    if (r.slots.length === 0) return `Sin huecos libres el ${fechaNatural(fecha)}.`;
    return `Huecos el ${fechaNatural(fecha)}: ${r.slots.map(hora).join(", ")}`;
  }

  if (nombre === "leads_calientes_sin_contestar") {
    const calientes = await leadsCalientesSinContestar(tenantId);
    if (calientes.length === 0) return "No hay ningún lead caliente sin contestar ahora mismo.";
    return calientes
      .map(
        (l) =>
          `${comoSeLlama(l)}${l.tratamientoInteres ? ` — ${l.tratamientoInteres}` : ""} · ${
            l.horasEsperando < 24 ? `${l.horasEsperando} h` : `${Math.floor(l.horasEsperando / 24)} días`
          } esperando${l.motivoCaliente ? ` · "${l.motivoCaliente}"` : ""}`,
      )
      .join("\n");
  }

  if (nombre === "leads") {
    const estado = typeof args.estado === "string" ? args.estado : undefined;
    let lista = await listarLeads(tenantId);
    if (ES_ESTADO(estado)) lista = lista.filter((l) => l.estado === estado);
    if (lista.length === 0) {
      return estado ? `No hay ningún lead en estado "${estado}".` : "Todavía no hay ningún lead apuntado.";
    }
    return lista
      .slice(0, 20)
      .map(
        (l) =>
          `${comoSeLlama(l)}${l.tratamientoInteres ? ` — ${l.tratamientoInteres}` : ""} [${ETIQUETA_ESTADO[l.estado]}]${
            l.caliente ? " · CALIENTE" : ""
          } · ${diasAbierto(l)} días`,
      )
      .join("\n");
  }

  return "No sé responder eso.";
}

function accionesDe(t: string): Accion[] {
  const s = t.toLowerCase();
  const out: Accion[] = [];
  if (/lead|valoraci[oó]n|caliente|contestar/.test(s)) out.push({ texto: "Ver leads y valoraciones", href: "/dashboard/leads-valoraciones" });
  if (/cita|agenda|hueco/.test(s)) out.push({ texto: "Abrir la agenda", href: "/dashboard/agenda-estetica" });
  if (/instagram|publicaci[oó]n|comentario|redes/.test(s)) out.push({ texto: "Ver redes", href: "/dashboard/redes-estetica" });
  const vistos = new Set<string>();
  return out.filter((a) => !vistos.has(a.href) && vistos.add(a.href)).slice(0, 2);
}

const SISTEMA = (hoy: string) => `Eres la recepción del panel de una clínica estética de AI-Team. Hoy es ${fechaNatural(hoy)} (${hoy}).

Contestas preguntas sobre la agenda, los huecos libres y, sobre todo, los LEADS: quién ha preguntado, quién sigue sin respuesta y quién ha llegado ya a una valoración. Y puedes crear citas, apuntar leads a mano y moverlos de estado. SOLO puedes hablar de lo que te devuelven tus herramientas: si no lo has consultado, no lo sabes, y lo dices así en vez de inventarlo.

Aquí el trabajo no es llenar huecos sueltos: es que el lead llegue a la valoración presencial. Un lead caliente sin contestar es lo que más aprieta.

Estilo: frases cortas, sin emojis, sin fórmulas de asistente ("¿en qué puedo ayudarte?"). Responde directo, como una compañera de mostrador, no como un buscador.

NUNCA des un precio de un tratamiento, ni una horquilla, ni consejo médico o estético: eso sale de la valoración con el profesional.

CUANDO TE PIDEN HACER ALGO (crear cita, apuntar un lead, moverlo de estado):
- Si te falta un dato imprescindible (fecha, hora, teléfono o @usuario para poder contestarle), PREGÚNTALO tú antes de llamar a la herramienta. No la llames a medias ni inventes el dato que falta.
- Cuando tengas todo, usa la herramienta "preparar_…" que toque. Esas herramientas NO hacen nada: dejan la acción propuesta.
- Después, di en una línea qué vas a hacer y pide que lo confirmen. Tal cual te lo devuelve la herramienta.
- NUNCA digas que ya está hecho, ni "listo", ni "creada", ni "apuntado": no lo está. Está esperando confirmación, y se da con un botón.
- Si la herramienta te dice que no está claro a quién se refiere, PREGÚNTALO con las opciones que te da. No elijas tú.
- Si te dice que no se puede, explica por qué en una línea.`;

const MAX_VUELTAS = 5;

export async function preguntarEstetica(opts: {
  tenantId: string;
  pregunta: string;
  historial?: Array<{ rol: "usuario" | "secretaria"; texto: string }>;
}): Promise<Respuesta> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { texto: "No puedo contestar: falta la clave de la IA en el servidor.", acciones: [] };
  }

  const mensajes: Array<{ role: "user" | "assistant"; content: unknown }> = [];
  for (const h of (opts.historial ?? []).slice(-6)) {
    mensajes.push({ role: h.rol === "usuario" ? "user" : "assistant", content: h.texto });
  }
  mensajes.push({ role: "user", content: opts.pregunta });
  let forzar = false;
  let reintentado = false;

  // Hora pasada / cerrado / fuera de horario: se dice tal cual y se corta (ver esPegaDeHora).
  let bloqueo: string | null = null;
  let pendiente: { resumen: string; accion: AccionPendiente } | null = null;

  try {
    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      const res = await anthropic.messages.create(
        {
          model: MODELS.fast,
          max_tokens: 900,
          system: SISTEMA(hoyISO()) + calendarioProximo(hoyISO()),
          tools: HERRAMIENTAS as never,
          ...(forzar ? { tool_choice: { type: "any" as const } } : {}),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messages: mensajes as any,
        },
        { timeout: 45_000 },
      );

      forzar = false;
      const usos = res.content.filter((b) => b.type === "tool_use");
      if (!usos.length) {
        const texto = res.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { text: string }).text)
          .join("")
          .trim();
        // Pide confirmar en texto sin haber llamado a la herramienta: no hay
        // recuadro, y el "sí" siguiente se lo inventaría. Se le obliga UNA vez a
        // llamar a la herramienta; si aun así no, `sinInventar` lo desmiente.
        if (!pendiente && !reintentado && pideConfirmarEnTexto(texto)) {
          reintentado = true;
          forzar = true;
          mensajes.push({ role: "assistant", content: texto });
          mensajes.push({ role: "user", content: NUDGE });
          continue;
        }
        return {
          texto: sinInventar(texto || "No he sabido contestar a eso.", !!pendiente, opts.pregunta),
          // Con una propuesta encima de la mesa no se ofrecen atajos a otras
          // pantallas: lo único que toca es decir sí o no.
          acciones: pendiente ? [] : accionesDe(`${opts.pregunta} ${texto}`),
          pendiente,
        };
      }

      mensajes.push({ role: "assistant", content: res.content });
      const resultados = [];
      for (const u of usos) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uu = u as any;

        const preparada: SalidaHerramienta | null = await prepararAccion(opts.tenantId, uu.name, uu.input as Args).catch(
          (e) => ({ texto: `Error preparando: ${e instanceof Error ? e.message : String(e)}` }),
        );
        if (preparada) {
          if (preparada.propuesta && !pendiente) pendiente = preparada.propuesta;
          if (preparada.bloqueo && !bloqueo) bloqueo = preparada.bloqueo;
          resultados.push({ type: "tool_result", tool_use_id: uu.id, content: preparada.texto });
          continue;
        }

        const salida = await ejecutarConsulta(opts.tenantId, uu.name, uu.input as Args).catch(
          (e) => `Error consultando: ${e instanceof Error ? e.message : String(e)}`,
        );
        resultados.push({ type: "tool_result", tool_use_id: uu.id, content: salida });
      }
      mensajes.push({ role: "user", content: resultados });

      // CORTE OBLIGATORIO. Copiado literal de `dental-consulta.ts`, donde este
      // fallo ya se pagó una vez: en cuanto hay una propuesta sobre la mesa se
      // devuelve YA, sin darle otra vuelta al modelo. Dársela era el fallo real
      // detrás de "confirmo algo y no aparece": el modelo veía su propio
      // "¿Confirmo?" como resultado de herramienta y, en la vuelta siguiente,
      // redactaba un texto final tipo "Hecho. Lead apuntado (id lead_xxxxxxxx)"
      // — con un id INVENTADO, sin que `ejecutar()` se hubiera llamado ni una
      // vez. El panel mostraba ese texto como si fuera cierto y el lead no
      // llegaba a existir. `pendiente` es la única fuente de verdad de si algo
      // quedó de verdad pendiente de confirmar: en cuanto existe, la respuesta
      // es su resumen — ni una palabra más generada por el modelo.
      if (!pendiente && bloqueo) {
        return { texto: bloqueo, acciones: [], pendiente: null };
      }
      if (pendiente) {
        return { texto: pendiente.resumen, acciones: [], pendiente };
      }
    }
    return { texto: "Me he liado dando vueltas a esa pregunta. Pruébame con algo más concreto.", acciones: [], pendiente: null };
  } catch (e) {
    console.error("[estetica/consulta]", e);
    return { texto: "No he podido contestar ahora mismo. Inténtalo otra vez en un momento.", acciones: [], pendiente: null };
  }
}
