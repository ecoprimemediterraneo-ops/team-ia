// Preguntarle al panel de la clínica en lenguaje normal — mismo criterio que
// `gestoria-consulta.ts`: el modelo NO recibe la base de datos entera, recibe
// unas pocas funciones de consulta y las llama. Si solo puede ver lo que esas
// funciones devuelven, no puede inventarse una cita que no existe.
//
// Y AHORA TAMBIÉN ESCRIBE, con la MISMA regla que gestoría: nada a la
// primera. Las herramientas "preparar_…" no cambian nada — devuelven una
// propuesta ({resumen, accion}) que se guarda en el turno del chat, y solo se
// ejecuta cuando el dueño confirma explícitamente (ver `dental-acciones.ts`
// y el `body.confirmar` de `/api/dental/preguntar`). El modelo nunca ve el
// resultado de haberlo hecho hasta que de verdad se ha hecho.

import "server-only";
import { anthropic, MODELS } from "./claude";
import {
  getBusinessesForTenant,
  listRecordsForRange,
  computeFreeSlots,
  resolverServicio,
  type BookingRecord,
} from "./booking";
import { candidatosRecall } from "./recall";
import { presupuestosPendientes } from "./presupuestos";
import { urgenciasSinCita } from "./dental-urgencias";
import {
  prepararCrearCita,
  prepararCrearPresupuesto,
  prepararCambiarEstadoPresupuesto,
  prepararAvisarRevision,
  type AccionPendiente,
} from "./dental-acciones";

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

const HERRAMIENTAS = [
  {
    name: "citas_del_dia",
    description: "Las citas de un día concreto: hora, paciente y tratamiento. Si no se da fecha, hoy.",
    input_schema: {
      type: "object" as const,
      properties: { fecha: { type: "string", description: "AAAA-MM-DD. Si se omite, hoy." } },
    },
  },
  {
    name: "huecos_libres",
    description: "Huecos libres de un día, calculados con la duración del servicio más habitual. Si no se da fecha, hoy.",
    input_schema: {
      type: "object" as const,
      properties: { fecha: { type: "string", description: "AAAA-MM-DD. Si se omite, hoy." } },
    },
  },
  {
    name: "revisiones_pendientes",
    description: "Pacientes a los que les toca una revisión y no tienen nada en agenda, ordenados por retraso.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "presupuestos_pendientes",
    description: "Presupuestos dados que siguen sin cerrarse (ni aceptados ni rechazados).",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "urgencias_sin_cita",
    description: "Pacientes que han escrito con dolor o urgencia y TODAVÍA no tienen cita puesta. Úsala con '¿hay alguna urgencia?' o '¿a quién hay que meter hoy?'.",
    input_schema: { type: "object" as const, properties: {} },
  },

  // --- ACCIONES: estas CAMBIAN datos ---------------------------------------
  // Ninguna ejecuta nada. Todas PREPARAN y devuelven una propuesta que el
  // dueño tiene que aprobar. Ver `dental-acciones.ts` para el porqué.
  {
    name: "preparar_crear_cita",
    description:
      "PREPARA crear una cita nueva. No la crea: devuelve una propuesta para que el dueño la apruebe. Necesitas nombre del paciente, tratamiento, fecha y hora. Si falta alguno, PREGÚNTALO en vez de llamar a la herramienta a medias.",
    input_schema: {
      type: "object" as const,
      properties: {
        nombre: { type: "string", description: "Nombre del paciente." },
        telefono: { type: "string", description: "Teléfono del paciente, si lo dan." },
        tratamiento: { type: "string", description: "Qué se le va a hacer: 'revisión', 'limpieza', 'implante'…" },
        fecha: { type: "string", description: "AAAA-MM-DD." },
        hora: { type: "string", description: "HH:mm, 24 horas." },
      },
      required: ["nombre", "tratamiento", "fecha", "hora"],
    },
  },
  {
    name: "preparar_crear_presupuesto",
    description:
      "PREPARA apuntar un presupuesto nuevo. No lo apunta: devuelve una propuesta. Necesitas nombre del paciente y tratamiento; el importe y el teléfono son opcionales, pero si el dueño los da, inclúyelos.",
    input_schema: {
      type: "object" as const,
      properties: {
        nombre: { type: "string" },
        telefono: { type: "string" },
        tratamiento: { type: "string" },
        importeEUR: { type: "number" },
      },
      required: ["nombre", "tratamiento"],
    },
  },
  {
    name: "preparar_cambiar_estado_presupuesto",
    description:
      "PREPARA aceptar o rechazar un presupuesto ya existente. Úsala con 'el presupuesto de María lo ha aceptado' o 'Carlos ha dicho que no al implante'.",
    input_schema: {
      type: "object" as const,
      properties: {
        paciente: { type: "string", description: "Nombre del paciente del presupuesto." },
        estado: { type: "string", enum: ["aceptado", "rechazado"] },
      },
      required: ["paciente", "estado"],
    },
  },
  {
    name: "preparar_avisar_revision",
    description:
      "PREPARA el aviso de revisión de un paciente que ya le toca. Dos modos: 'enviado' — ya le has avisado tú, por teléfono o en persona ('avisa a Pedro de la revisión', 'ya he llamado a María para la revisión') — o 'programado' — todavía no, pero quieres anotarlo para una fecha ('prográmame avisar a Pedro el día 20'). Si piden programar y no dan fecha, PREGÚNTALA antes de llamar a la herramienta.",
    input_schema: {
      type: "object" as const,
      properties: {
        paciente: { type: "string" },
        modo: { type: "string", enum: ["enviado", "programado"] },
        fecha: { type: "string", description: "AAAA-MM-DD. Solo si modo es 'programado'." },
      },
      required: ["paciente", "modo"],
    },
  },
] as const;

type Args = Record<string, unknown>;

/** Lo que una herramienta le devuelve al modelo, más la acción si la preparó. */
type SalidaHerramienta = { texto: string; propuesta?: { resumen: string; accion: AccionPendiente } };

const str = (args: Args, k: string): string | undefined => {
  const v = args[k];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};
const num = (args: Args, k: string): number | undefined => {
  const v = args[k];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
};

/**
 * Las acciones se preparan aquí y NO se ejecutan. Devuelven al modelo una
 * frase para que se la lea al dueño, y aparte la acción ya resuelta, que se
 * guarda para cuando confirme. El modelo nunca toca los datos: como mucho,
 * propone.
 */
async function prepararAccion(tenantId: string, nombre: string, args: Args): Promise<SalidaHerramienta | null> {
  let r: import("./dental-acciones").Preparada | null = null;
  if (nombre === "preparar_crear_cita") {
    r = await prepararCrearCita(tenantId, {
      nombre: str(args, "nombre"), telefono: str(args, "telefono"),
      tratamiento: str(args, "tratamiento"), fecha: str(args, "fecha"), hora: str(args, "hora"),
    });
  } else if (nombre === "preparar_crear_presupuesto") {
    r = await prepararCrearPresupuesto(tenantId, {
      nombre: str(args, "nombre"), telefono: str(args, "telefono"),
      tratamiento: str(args, "tratamiento"), importeEUR: num(args, "importeEUR"),
    });
  } else if (nombre === "preparar_cambiar_estado_presupuesto") {
    const estado = str(args, "estado");
    if (estado !== "aceptado" && estado !== "rechazado") {
      return { texto: "El estado tiene que ser 'aceptado' o 'rechazado'." };
    }
    r = await prepararCambiarEstadoPresupuesto(tenantId, str(args, "paciente") ?? "", estado);
  } else if (nombre === "preparar_avisar_revision") {
    const modo = str(args, "modo") === "programado" ? "programado" : "enviado";
    r = await prepararAvisarRevision(tenantId, str(args, "paciente") ?? "", modo, str(args, "fecha"));
  } else {
    return null;
  }

  if (r.tipo === "propuesta") {
    return {
      texto: `PROPUESTA LISTA. Dile al dueño exactamente esto y pídele que confirme: "${r.resumen}". No digas que ya está hecho: no lo está hasta que confirme.`,
      propuesta: { resumen: r.resumen, accion: r.accion },
    };
  }
  if (r.tipo === "ambiguo") {
    return { texto: `NO ESTÁ CLARO A QUÉ SE REFIERE. Pregúntaselo: ${r.pregunta}\nOpciones:\n- ${r.opciones.join("\n- ")}` };
  }
  return { texto: `NO SE PUEDE: ${r.motivo}` };
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
    if (!servicio) return "Todavía no hay ningún servicio configurado, así que no se pueden calcular huecos.";
    const fecha = (typeof args.fecha === "string" && args.fecha) || hoyISO();
    const sel = resolverServicio(servicio, {});
    const r = await computeFreeSlots(negocio, sel, fecha, "https://aiteam.marketing/api/lucia/callback");
    if (!r.ok) return `No se ha podido consultar la agenda: ${r.detail}`;
    if (r.slots.length === 0) return `Sin huecos libres el ${fechaNatural(fecha)}.`;
    return `Huecos el ${fechaNatural(fecha)}: ${r.slots.map(hora).join(", ")}`;
  }

  if (nombre === "revisiones_pendientes") {
    const candidatos = await candidatosRecall(tenantId, { incluirAvisados: false });
    if (candidatos.length === 0) return "Ahora mismo no le toca revisión a nadie.";
    return candidatos
      .slice(0, 15)
      .map((c) => `${c.nombre || "sin nombre"} — ${c.motivo}, ${c.diasDeRetraso} días de retraso (última visita: ${c.ultimaVisita.slice(0, 10)})`)
      .join("\n");
  }

  if (nombre === "presupuestos_pendientes") {
    const pendientes = await presupuestosPendientes(tenantId);
    if (pendientes.length === 0) return "No hay presupuestos pendientes.";
    return pendientes
      .slice(0, 15)
      .map((p) => `${p.paciente.nombre} — ${p.concepto}${p.importeEUR != null ? `, ${p.importeEUR.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}` : ""} (${p.diasDesdeQueSeDio} días parado)`)
      .join("\n");
  }

  if (nombre === "urgencias_sin_cita") {
    const urgencias = await urgenciasSinCita(tenantId);
    if (urgencias.length === 0) return "No hay ninguna urgencia sin atender ahora mismo.";
    return urgencias
      .map((u) => `${u.nombre || "sin nombre"} (${u.telefono}) — ${u.diasEsperando === 0 ? "hoy mismo" : `${u.diasEsperando} días esperando`}: "${u.texto}"`)
      .join("\n");
  }

  return "No sé responder eso.";
}

function accionesDe(t: string): Accion[] {
  const s = t.toLowerCase();
  const out: Accion[] = [];
  if (/urgenc/.test(s)) out.push({ texto: "Ver urgencias en Hoy", href: "/dashboard" });
  if (/cita|agenda|hueco/.test(s)) out.push({ texto: "Abrir la agenda", href: "/dashboard/citas" });
  if (/revisi[oó]n|presupuesto/.test(s)) out.push({ texto: "Ver presupuestos y revisiones", href: "/dashboard/presupuestos-revisiones" });
  const vistos = new Set<string>();
  return out.filter((a) => !vistos.has(a.href) && vistos.add(a.href)).slice(0, 2);
}

const SISTEMA = (hoy: string) => `Eres la secretaria del panel de una clínica dental de AI-Team. Hoy es ${fechaNatural(hoy)} (${hoy}).

Contestas preguntas sobre la agenda, los huecos libres, las revisiones pendientes y los presupuestos parados, y puedes crear citas, apuntar presupuestos, cambiarles el estado y marcar avisos de revisión. SOLO puedes hablar de lo que te devuelven tus herramientas: si no lo has consultado, no lo sabes, y lo dices así en vez de inventarlo.

Estilo: frases cortas, sin emojis, sin fórmulas de asistente ("¿en qué puedo ayudarte?", "estoy aquí para ayudarte"). Responde directo, como una compañera de mostrador, no como un buscador.

CUANDO TE PIDEN HACER ALGO (crear cita, apuntar presupuesto, aceptar/rechazar uno, marcar revisión):
- Si te falta un dato imprescindible (fecha, hora, importe, teléfono si hace falta para localizar a alguien), PREGÚNTALO tú antes de llamar a la herramienta. No la llames a medias ni inventes el dato que falta.
- Cuando tengas todo, usa la herramienta "preparar_…" que toque. Esas herramientas NO hacen nada: dejan la acción propuesta.
- Después, dile al dueño en una línea qué vas a hacer y pídele que lo confirme. Tal cual te lo devuelve la herramienta.
- NUNCA digas que ya está hecho, ni "listo", ni "creada", ni "apuntado": no lo está. Está esperando su confirmación, y la da con un botón.
- Si la herramienta te dice que no está claro a qué se refiere, PREGÚNTASELO con las opciones que te da. No elijas tú.
- Si te dice que no se puede, explícale por qué en una línea.`;

const MAX_VUELTAS = 5;

export async function preguntarDental(opts: {
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

  let pendiente: { resumen: string; accion: AccionPendiente } | null = null;

  try {
    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      const res = await anthropic.messages.create(
        {
          model: MODELS.fast,
          max_tokens: 900,
          system: SISTEMA(hoyISO()),
          tools: HERRAMIENTAS as never,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messages: mensajes as any,
        },
        { timeout: 45_000 },
      );

      const usos = res.content.filter((b) => b.type === "tool_use");
      if (!usos.length) {
        const texto = res.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { text: string }).text)
          .join("")
          .trim();
        return {
          texto: texto || "No he sabido contestar a eso.",
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
          resultados.push({ type: "tool_result", tool_use_id: uu.id, content: preparada.texto });
          continue;
        }

        const salida = await ejecutarConsulta(opts.tenantId, uu.name, uu.input as Args).catch(
          (e) => `Error consultando: ${e instanceof Error ? e.message : String(e)}`,
        );
        resultados.push({ type: "tool_result", tool_use_id: uu.id, content: salida });
      }
      mensajes.push({ role: "user", content: resultados });

      // CORTE OBLIGATORIO. En cuanto hay una propuesta sobre la mesa, se
      // devuelve YA — no se le da otra vuelta al modelo. Dársela era el fallo
      // real detrás de "confirmo un presupuesto y no aparece": el modelo veía
      // su propio "¿Confirmo?" como resultado de herramienta y, en la vuelta
      // siguiente, redactaba un texto final que decía "Hecho. Presupuesto
      // apuntado (id pres_xxxxxxxx)" — con un id INVENTADO, sin que
      // `ejecutar()` se hubiera llamado ni una vez. El panel mostraba ese
      // texto como si fuera cierto y el presupuesto nunca llegaba a
      // `data/presupuestos.json`. `pendiente` es la única fuente de verdad de
      // si algo quedó de verdad pendiente de confirmar: en cuanto existe, la
      // respuesta es su resumen — ni una palabra más generada por el modelo.
      if (pendiente) {
        return { texto: pendiente.resumen, acciones: [], pendiente };
      }
    }
    return { texto: "Me he liado dando vueltas a esa pregunta. Pruébame con algo más concreto.", acciones: [], pendiente: null };
  } catch (e) {
    console.error("[dental/consulta]", e);
    return { texto: "No he podido contestar ahora mismo. Inténtalo otra vez en un momento.", acciones: [], pendiente: null };
  }
}
