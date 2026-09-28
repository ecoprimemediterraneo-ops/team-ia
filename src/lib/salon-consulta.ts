// Preguntarle al panel del salón en lenguaje normal — mismo criterio que
// `dental-consulta.ts` y `estetica-consulta.ts`: el modelo NO recibe la base de
// datos entera, recibe unas pocas funciones de consulta y las llama. Si solo
// puede ver lo que esas funciones devuelven, no puede inventarse una cita, una
// clienta o un hueco que no existen.
//
// Y también ESCRIBE, con la MISMA regla: nada a la primera. Las herramientas
// "preparar_…" no cambian nada — devuelven una propuesta ({resumen, accion}) que
// se guarda en el turno del chat y solo se ejecuta al confirmar (ver
// `salon-acciones.ts` y el `body.confirmar` de `/api/salon/preguntar`).

import "server-only";
import { sinInventar, pideConfirmarEnTexto, NUDGE } from "./chat-honesto";
import { anthropic, MODELS } from "./claude";
import {
  getBusinessesForTenant,
  listRecordsForRange,
  computeFreeSlots,
  resolverServicio,
  listEspera,
  listClientasDormidasCompleto,
  type BookingRecord,
} from "./booking";
import {
  prepararCrearCita,
  prepararMoverCita,
  prepararCancelarCita,
  prepararApuntarEspera,
  prepararMensajeReactivacion,
  buscarServicio,
  type AccionPendiente,
  type Preparada,
} from "./salon-acciones";

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
    description: "Las citas de un día, agrupadas por profesional: hora, clienta y servicio. Si no se da fecha, hoy.",
    input_schema: {
      type: "object" as const,
      properties: { fecha: { type: "string", description: "AAAA-MM-DD. Si se omite, hoy." } },
    },
  },
  {
    name: "huecos_libres",
    description:
      "Huecos libres de un día POR PROFESIONAL. Puedes acotar por servicio (sale con su duración) y por profesional. Si no se da fecha, hoy.",
    input_schema: {
      type: "object" as const,
      properties: {
        fecha: { type: "string", description: "AAAA-MM-DD. Si se omite, hoy." },
        servicio: { type: "string", description: "Servicio concreto ('corte', 'manicura')." },
        profesional: { type: "string", description: "Nombre de una profesional." },
      },
    },
  },
  {
    name: "clientas_dormidas",
    description:
      "Las clientas que venían y llevan más de 60 días sin volver ni tener cita: con cuánto tiempo, su profesional de siempre y su servicio habitual. Úsala con '¿a quién hay que recuperar?' o '¿quién ha dejado de venir?'.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "lista_de_espera",
    description: "Quién espera un hueco, para qué servicio y qué día.",
    input_schema: { type: "object" as const, properties: {} },
  },

  // --- ACCIONES: estas CAMBIAN datos ---------------------------------------
  // Ninguna ejecuta nada. Todas PREPARAN y devuelven una propuesta que hay que
  // aprobar. Ver `salon-acciones.ts` para el porqué.
  {
    name: "preparar_crear_cita",
    description:
      "PREPARA crear una cita. No la crea: devuelve una propuesta para que la dueña la apruebe. Necesitas nombre de la clienta, servicio, fecha y hora; la profesional es opcional (si no la dicen, se asigna la primera libre). Si falta un dato, PREGÚNTALO en vez de llamar a la herramienta a medias.",
    input_schema: {
      type: "object" as const,
      properties: {
        nombre: { type: "string" },
        telefono: { type: "string", description: "Teléfono, si lo dan." },
        servicio: { type: "string", description: "'corte y peinado', 'manicura'…" },
        profesional: { type: "string", description: "Con quién, si lo piden." },
        fecha: { type: "string", description: "AAAA-MM-DD." },
        hora: { type: "string", description: "HH:mm, 24 horas." },
      },
      required: ["nombre", "servicio", "fecha", "hora"],
    },
  },
  {
    name: "preparar_mover_cita",
    description: "PREPARA mover una cita a otro día u hora. Necesitas de quién es y el día y hora nuevos.",
    input_schema: {
      type: "object" as const,
      properties: {
        quien: { type: "string", description: "Nombre o teléfono de la clienta." },
        fechaActual: { type: "string", description: "AAAA-MM-DD de la cita actual, si tiene varias." },
        nuevaFecha: { type: "string", description: "AAAA-MM-DD." },
        nuevaHora: { type: "string", description: "HH:mm." },
      },
      required: ["quien", "nuevaFecha", "nuevaHora"],
    },
  },
  {
    name: "preparar_cancelar_cita",
    description: "PREPARA cancelar una cita. No la cancela: devuelve una propuesta.",
    input_schema: {
      type: "object" as const,
      properties: {
        quien: { type: "string", description: "Nombre o teléfono de la clienta." },
        fecha: { type: "string", description: "AAAA-MM-DD, si tiene varias citas." },
      },
      required: ["quien"],
    },
  },
  {
    name: "preparar_apuntar_espera",
    description:
      "PREPARA apuntar a alguien en la lista de espera. Necesitas nombre, TELÉFONO (sin él no se le puede avisar), servicio y el día que quiere. Si falta algo, PREGÚNTALO.",
    input_schema: {
      type: "object" as const,
      properties: {
        nombre: { type: "string" },
        telefono: { type: "string" },
        servicio: { type: "string" },
        profesional: { type: "string", description: "Si quiere con una en concreto." },
        fecha: { type: "string", description: "AAAA-MM-DD." },
        hora: { type: "string", description: "HH:mm, si dice una hora." },
      },
      required: ["nombre", "telefono", "servicio", "fecha"],
    },
  },
  {
    name: "preparar_mensaje_reactivacion",
    description:
      "PREPARA el mensaje para que vuelva una clienta dormida. NO envía nada: al confirmar se le enseña el texto a la dueña para que lo mande ella.",
    input_schema: {
      type: "object" as const,
      properties: { quien: { type: "string", description: "Nombre o teléfono de la clienta dormida." } },
      required: ["quien"],
    },
  },
] as const;

type Args = Record<string, unknown>;
type SalidaHerramienta = { texto: string; propuesta?: { resumen: string; accion: AccionPendiente } };

const str = (args: Args, k: string): string | undefined => {
  const v = args[k];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

async function prepararAccion(tenantId: string, nombre: string, args: Args): Promise<SalidaHerramienta | null> {
  let r: Preparada | null = null;
  if (nombre === "preparar_crear_cita") {
    r = await prepararCrearCita(tenantId, {
      nombre: str(args, "nombre"), telefono: str(args, "telefono"), servicio: str(args, "servicio"),
      profesional: str(args, "profesional"), fecha: str(args, "fecha"), hora: str(args, "hora"),
    });
  } else if (nombre === "preparar_mover_cita") {
    r = await prepararMoverCita(tenantId, {
      quien: str(args, "quien"), fechaActual: str(args, "fechaActual"), nuevaFecha: str(args, "nuevaFecha"), nuevaHora: str(args, "nuevaHora"),
    });
  } else if (nombre === "preparar_cancelar_cita") {
    r = await prepararCancelarCita(tenantId, { quien: str(args, "quien"), fecha: str(args, "fecha") });
  } else if (nombre === "preparar_apuntar_espera") {
    r = await prepararApuntarEspera(tenantId, {
      nombre: str(args, "nombre"), telefono: str(args, "telefono"), servicio: str(args, "servicio"),
      profesional: str(args, "profesional"), fecha: str(args, "fecha"), hora: str(args, "hora"),
    });
  } else if (nombre === "preparar_mensaje_reactivacion") {
    r = await prepararMensajeReactivacion(tenantId, { quien: str(args, "quien") });
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
    return { texto: `NO ESTÁ CLARO. Pregúntaselo: ${r.pregunta}\nOpciones:\n- ${r.opciones.join("\n- ")}` };
  }
  return { texto: `NO SE PUEDE: ${r.motivo}` };
}

async function ejecutarConsulta(tenantId: string, nombre: string, args: Args): Promise<string> {
  const negocio = (await getBusinessesForTenant(tenantId))[0];

  if (nombre === "citas_del_dia") {
    if (!negocio) return "No hay ninguna agenda conectada todavía.";
    const fecha = str(args, "fecha") || hoyISO();
    const citas = (await listRecordsForRange(negocio.slug, fecha, fecha)).filter(
      (r) => r.tipo === "cita" && (r.estado === "pendiente" || r.estado === "confirmada"),
    );
    if (citas.length === 0) return `Sin citas el ${fechaNatural(fecha)}.`;
    const porProf = new Map<string, BookingRecord[]>();
    for (const r of citas) {
      const k = r.empleadoNombre || "Sin asignar";
      porProf.set(k, [...(porProf.get(k) ?? []), r]);
    }
    return [...porProf.entries()]
      .map(([p, rs]) => `${p}:\n${rs.map((r) => `  ${hora(r.startIso)} — ${r.cliente.nombre || "sin nombre"} (${[r.servicioNombre, r.varianteNombre].filter(Boolean).join(" · ")})`).join("\n")}`)
      .join("\n");
  }

  if (nombre === "huecos_libres") {
    if (!negocio) return "No hay ninguna agenda conectada todavía.";
    const fecha = str(args, "fecha") || hoyISO();
    let equipo = (negocio.empleados || []).filter((e) => e.activo);
    if (str(args, "profesional")) {
      const q = str(args, "profesional")!.toLowerCase();
      equipo = equipo.filter((e) => e.nombre.toLowerCase().includes(q));
      if (equipo.length === 0) return `No hay ninguna profesional que se llame "${str(args, "profesional")}".`;
    }
    let servicios = negocio.servicios.filter((s) => s.activo);
    if (str(args, "servicio")) {
      servicios = buscarServicio(negocio, str(args, "servicio")!).encontrados;
      if (servicios.length === 0) return `No tengo ningún servicio que encaje con "${str(args, "servicio")}".`;
    }
    if (servicios.length === 0) return "Todavía no hay ningún servicio configurado, así que no se pueden calcular huecos.";
    const lineas: string[] = [];
    // Sin personal dado de alta: una sola agenda.
    const sujetos: Array<{ id?: string; nombre: string; ids?: string[] }> = equipo.length
      ? equipo.map((e) => ({ id: e.id, nombre: e.nombre, ids: e.serviceIds }))
      : [{ nombre: "Agenda del salón" }];
    for (const s of sujetos) {
      const propio = servicios.find((sv) => !s.ids?.length || s.ids.includes(sv.id));
      if (!propio) continue;
      const r = await computeFreeSlots(negocio, resolverServicio(propio, {}), fecha, "https://aiteam.marketing/api/lucia/callback", undefined, s.id);
      if (!r.ok) return `No se ha podido consultar la agenda: ${r.detail}`;
      lineas.push(`${s.nombre} (para ${propio.nombre}, ${propio.durationMin} min): ${r.slots.length ? r.slots.map(hora).join(", ") : "sin huecos"}`);
    }
    return lineas.length ? `Huecos el ${fechaNatural(fecha)}:\n${lineas.join("\n")}` : "Ninguna profesional hace ese servicio.";
  }

  if (nombre === "clientas_dormidas") {
    if (!negocio) return "No hay ninguna agenda conectada todavía.";
    const d = await listClientasDormidasCompleto(negocio.slug);
    if (d.length === 0) return "No hay ninguna clienta dormida ahora mismo (venían y llevan más de 60 días sin volver ni tener cita).";
    return d
      .slice(0, 15)
      .map(
        (c) =>
          `${c.nombre} — ${c.diasSinVenir} días sin venir, ${c.visitas} visita${c.visitas === 1 ? "" : "s"}${c.servicioHabitual ? `, suele hacerse ${c.servicioHabitual.toLowerCase()}` : ""}${c.profesionalHabitual ? ` con ${c.profesionalHabitual}` : ""}${c.reactivacionEnviadaIso ? ` · ya avisada hace ${c.diasDesdeAviso} días` : ""}`,
      )
      .join("\n");
  }

  if (nombre === "lista_de_espera") {
    if (!negocio) return "No hay ninguna agenda conectada todavía.";
    const e = (await listEspera(negocio.slug)).filter((x) => x.estado === "esperando");
    if (e.length === 0) return "No hay nadie esperando hueco ahora mismo.";
    return e
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((x) => `${x.cliente.nombre} — ${x.servicioNombre}${x.empleadoNombre ? ` con ${x.empleadoNombre}` : ""} · ${fechaNatural(x.fecha)}${x.horaPedida ? ` (a las ${x.horaPedida})` : ""}`)
      .join("\n");
  }

  return "No sé responder eso.";
}

function accionesDe(t: string): Accion[] {
  const s = t.toLowerCase();
  const out: Accion[] = [];
  if (/dormida|recuperar|dejado de venir|clienta/.test(s)) out.push({ texto: "Ver clientas", href: "/dashboard/clientas-salon" });
  if (/espera/.test(s)) out.push({ texto: "Ver lista de espera", href: "/dashboard/lista-espera" });
  if (/cita|agenda|hueco|profesional/.test(s)) out.push({ texto: "Abrir la agenda", href: "/dashboard/agenda-salon" });
  if (/instagram|publicaci[oó]n|comentario|redes|rese[nñ]a/.test(s)) out.push({ texto: "Ver redes y reseñas", href: "/dashboard/redes-salon" });
  const vistos = new Set<string>();
  return out.filter((a) => !vistos.has(a.href) && vistos.add(a.href)).slice(0, 2);
}

const SISTEMA = (hoy: string) => `Eres la recepción del panel de un salón de belleza de AI-Team. Hoy es ${fechaNatural(hoy)} (${hoy}).

Contestas preguntas sobre la agenda de cada profesional, los huecos libres, la lista de espera y las clientas dormidas, y puedes crear citas, moverlas, cancelarlas, apuntar a alguien en la lista de espera y preparar el mensaje para que vuelva una clienta. SOLO puedes hablar de lo que te devuelven tus herramientas: si no lo has consultado, no lo sabes, y lo dices así en vez de inventarlo.

En un salón el dinero se pierde en el hueco vacío y en la clienta que deja de venir. Habla de "clientas", "servicios" y "citas".

Estilo: cercana y directa, frases cortas, sin emojis, sin fórmulas de asistente ("¿en qué puedo ayudarte?"). Tuteo, como una compañera de mostrador.

CUANDO TE PIDEN HACER ALGO (crear, mover o cancelar una cita, apuntar en la lista de espera, preparar un mensaje):
- Si te falta un dato imprescindible, PREGÚNTALO tú antes de llamar a la herramienta. No la llames a medias ni inventes el dato que falta. Para CREAR o MOVER una cita: nombre, servicio, día y hora. Para la LISTA DE ESPERA: nombre, teléfono, servicio y día — la hora es opcional, no la pidas.
- Cuando tengas todo, usa la herramienta "preparar_…" que toque. Esas herramientas NO hacen nada: dejan la acción propuesta.
- Después, di en una línea qué vas a hacer y pide que lo confirmen. Tal cual te lo devuelve la herramienta.
- NUNCA digas que ya está hecho, ni "listo", ni "creada", ni "cancelada": no lo está. Está esperando confirmación, y se da con un botón.
- Si la herramienta te dice que no está claro, PREGÚNTALO con las opciones que te da. No elijas tú.
- Si te dice que no se puede, explica por qué en una línea.
- "Preparar el mensaje" a una clienta NO lo envía: solo lo redacta para que lo mande la dueña.`;

const MAX_VUELTAS = 5;

export async function preguntarSalon(opts: {
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

  let pendiente: { resumen: string; accion: AccionPendiente } | null = null;

  try {
    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      const res = await anthropic.messages.create(
        {
          model: MODELS.fast,
          max_tokens: 900,
          system: SISTEMA(hoyISO()),
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
          texto: sinInventar(texto || "No he sabido contestar a eso.", !!pendiente),
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

      // CORTE OBLIGATORIO (mismo que dental y estética, donde este fallo ya se
      // pagó): en cuanto hay una propuesta sobre la mesa se devuelve YA, sin dar
      // otra vuelta al modelo. Dársela dejaba que redactara un "Hecho. Cita
      // creada (id inventado)" sin que `ejecutar()` se hubiera llamado ni una vez.
      // `pendiente` es la única fuente de verdad de si algo quedó por confirmar.
      if (pendiente) {
        return { texto: pendiente.resumen, acciones: [], pendiente };
      }
    }
    return { texto: "Me he liado dando vueltas a esa pregunta. Pruébame con algo más concreto.", acciones: [], pendiente: null };
  } catch (e) {
    console.error("[salon/consulta]", e);
    return { texto: "No he podido contestar ahora mismo. Inténtalo otra vez en un momento.", acciones: [], pendiente: null };
  }
}
