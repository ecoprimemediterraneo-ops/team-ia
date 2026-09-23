// Lo que el chat de estética puede HACER, no solo contar — mismo patrón que
// `dental-acciones.ts`: cada acción se PREPARA (se resuelve y se describe en
// una frase) y no se ejecuta hasta que la dueña de la clínica dice que sí. El
// modelo nunca toca los datos directamente; como mucho, propone.
//
// AQUÍ NO SE DUPLICA LÓGICA. La cita va contra `reservarSlot` del orquestador
// central —mismo motor, mismo candado que usan Pablo y Marta, nunca un camino
// paralelo— y los leads contra `estetica-leads.ts`.

import "server-only";
import { getBusinessesForTenant } from "./booking";
import {
  registrarLead,
  cambiarEstadoLead,
  buscarLeads,
  ETIQUETA_ESTADO,
  type EstadoLead,
  type Lead,
} from "./estetica-leads";

const FOUNDER_EMAIL_FALLBACK = "ecoprimemediterraneo@gmail.com";
const REDIRECT_URI = "https://aiteam.marketing/api/lucia/callback";

export type Preparada =
  | { tipo: "propuesta"; resumen: string; accion: AccionPendiente }
  | { tipo: "ambiguo"; pregunta: string; opciones: string[] }
  | { tipo: "nada"; motivo: string };

/** La acción ya resuelta, lista para ejecutarse en cuanto se diga que sí. */
export type AccionPendiente =
  | { clase: "crear_cita"; tenantId: string; nombre: string; telefono: string; tratamiento: string; startIso: string; etiqueta: string }
  | { clase: "crear_lead"; tenantId: string; nombre: string; telefono: string; instagram?: string; tratamientoInteres?: string; caliente: boolean; motivoCaliente?: string; etiqueta: string }
  | { clase: "cambiar_estado_lead"; tenantId: string; leadId: string; estado: EstadoLead; etiqueta: string };

function fechaNatural(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

function comoSeLlama(l: Lead): string {
  return l.nombre || (l.instagram ? `@${l.instagram.replace(/^@/, "")}` : l.telefono) || "sin nombre";
}

// -----------------------------------------------------------------------------
// Preparar cada acción
// -----------------------------------------------------------------------------

/** "ponle valoración a Marta Ruiz el jueves a las 10 para ácido hialurónico" */
export async function prepararCrearCita(
  tenantId: string,
  args: { nombre?: string; telefono?: string; tratamiento?: string; fecha?: string; hora?: string },
): Promise<Preparada> {
  const faltan: string[] = [];
  if (!args.nombre?.trim()) faltan.push("el nombre");
  if (!args.tratamiento?.trim()) faltan.push("el tratamiento");
  if (!args.fecha?.trim()) faltan.push("la fecha");
  if (!args.hora?.trim()) faltan.push("la hora");
  if (faltan.length) {
    return { tipo: "nada", motivo: `Para la valoración me falta: ${faltan.join(", ")}. Pregúntaselo.` };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.fecha!)) {
    return { tipo: "nada", motivo: `"${args.fecha}" no es una fecha válida (AAAA-MM-DD). Pregunta de nuevo el día.` };
  }
  if (!/^\d{2}:\d{2}$/.test(args.hora!)) {
    return { tipo: "nada", motivo: `"${args.hora}" no es una hora válida (HH:mm). Pregunta de nuevo la hora.` };
  }

  const negocios = await getBusinessesForTenant(tenantId);
  if (!negocios[0]) {
    return { tipo: "nada", motivo: "Esta clínica todavía no tiene una agenda conectada." };
  }

  const startIso = `${args.fecha}T${args.hora}:00`;
  const nombre = args.nombre!.trim();
  const telefono = (args.telefono || "").trim();
  const tratamiento = args.tratamiento!.trim();
  const etiqueta = `${tratamiento} de ${nombre} el ${fechaNatural(args.fecha!)} a las ${args.hora}`;

  return {
    tipo: "propuesta",
    resumen: `Crear cita: ${etiqueta}.`,
    accion: { clase: "crear_cita", tenantId, nombre, telefono, tratamiento, startIso, etiqueta },
  };
}

/** "apúntame un lead: Ana, 600111222, pregunta por láser facial" */
export async function prepararCrearLead(
  tenantId: string,
  args: {
    nombre?: string;
    telefono?: string;
    instagram?: string;
    tratamientoInteres?: string;
    caliente?: boolean;
    motivoCaliente?: string;
  },
): Promise<Preparada> {
  const nombre = (args.nombre || "").trim();
  const telefono = (args.telefono || "").trim();
  const instagram = (args.instagram || "").trim().replace(/^@/, "");
  if (!nombre) {
    return { tipo: "nada", motivo: "Para apuntar el lead me falta el nombre. Pregúntaselo." };
  }
  // Sin una forma de volver a hablar con la persona, el lead no sirve de nada:
  // sería una nota que nadie puede accionar. Se pide, no se inventa.
  if (!telefono && !instagram) {
    return { tipo: "nada", motivo: `De ${nombre} me falta el teléfono o su @usuario de Instagram. Sin una de las dos cosas no hay forma de contestarle.` };
  }

  const tratamientoInteres = (args.tratamientoInteres || "").trim() || undefined;
  const caliente = !!args.caliente;
  const motivoCaliente = caliente ? (args.motivoCaliente || "").trim() || "Marcado a mano como caliente" : undefined;
  const por = telefono ? telefono : `@${instagram}`;
  const etiqueta = `${nombre} (${por})${tratamientoInteres ? ` · ${tratamientoInteres}` : ""}${caliente ? " · caliente" : ""}`;

  return {
    tipo: "propuesta",
    resumen: `Apuntar lead: ${etiqueta}.`,
    accion: {
      clase: "crear_lead",
      tenantId,
      nombre,
      telefono,
      instagram: instagram || undefined,
      tratamientoInteres,
      caliente,
      motivoCaliente,
      etiqueta,
    },
  };
}

/** "a Ana ya la he llamado" / "Ana ya tiene la valoración puesta" / "descarta a Ana" */
export async function prepararCambiarEstadoLead(
  tenantId: string,
  quien: string,
  estado: EstadoLead,
): Promise<Preparada> {
  if (!quien?.trim()) {
    return { tipo: "nada", motivo: "Dime de qué lead se trata." };
  }
  const encontrados = await buscarLeads(tenantId, quien);
  if (!encontrados.length) {
    return { tipo: "nada", motivo: `No encuentro ningún lead que encaje con "${quien}".` };
  }
  if (encontrados.length > 1) {
    return {
      tipo: "ambiguo",
      pregunta: "Hay varios leads que encajan. ¿Cuál de estos?",
      opciones: encontrados.map(
        (l) => `${comoSeLlama(l)}${l.tratamientoInteres ? ` · ${l.tratamientoInteres}` : ""} · ${ETIQUETA_ESTADO[l.estado].toLowerCase()}`,
      ),
    };
  }
  const l = encontrados[0];
  if (l.estado === estado) {
    return { tipo: "nada", motivo: `${comoSeLlama(l)} ya está como "${ETIQUETA_ESTADO[estado].toLowerCase()}". No hay nada que cambiar.` };
  }
  const etiqueta = comoSeLlama(l);
  return {
    tipo: "propuesta",
    resumen: `Pasar a ${ETIQUETA_ESTADO[estado].toLowerCase()} el lead de ${etiqueta}.`,
    accion: { clase: "cambiar_estado_lead", tenantId, leadId: l.id, estado, etiqueta },
  };
}

// -----------------------------------------------------------------------------
// Ejecutar — SOLO se llama tras la confirmación explícita del usuario
// -----------------------------------------------------------------------------

export type ResultadoEjecucion = { ok: boolean; texto: string };

export async function ejecutar(tenantId: string, accion: AccionPendiente): Promise<ResultadoEjecucion> {
  // Blindaje de tenant: la acción lleva SU tenantId de cuando se preparó, y
  // aquí se comprueba contra el tenant de quien confirma. Si no coinciden —el
  // panel de otra clínica se ha colado por lo que sea— no se ejecuta nada.
  if (accion.tenantId !== tenantId) {
    return { ok: false, texto: "Esta propuesta no es de esta clínica. No se ha hecho nada." };
  }

  if (accion.clase === "crear_cita") {
    const { reservarSlot } = await import("./orchestrator");
    const founderEmail = process.env.FOUNDER_EMAIL || FOUNDER_EMAIL_FALLBACK;
    const res = await reservarSlot({
      tenantId,
      userEmail: founderEmail,
      redirectUri: REDIRECT_URI,
      nombre: accion.nombre,
      motivo: accion.tratamiento,
      startIso: accion.startIso,
      agenteOrigen: "dashboard",
      customerPhone: accion.telefono || undefined,
    });
    if (res.ok) return { ok: true, texto: `Hecho. Cita creada: ${accion.etiqueta}.` };
    if (res.reason === "slot_taken" || res.reason === "locked") {
      return { ok: false, texto: "Ese hueco ya está ocupado, no se ha creado la cita. Prueba con otra hora." };
    }
    return { ok: false, texto: `No se ha podido crear la cita: ${res.detail}.` };
  }

  if (accion.clase === "crear_lead") {
    const { lead, nuevo } = await registrarLead({
      tenantId,
      nombre: accion.nombre,
      telefono: accion.telefono,
      instagram: accion.instagram,
      tratamientoInteres: accion.tratamientoInteres,
      caliente: accion.caliente,
      motivoCaliente: accion.motivoCaliente,
    });
    return {
      ok: true,
      texto: nuevo
        ? `Hecho. Lead apuntado: ${accion.etiqueta} (id ${lead.id}).`
        : `Ya había un lead de ${accion.etiqueta}; lo he actualizado en vez de duplicarlo (id ${lead.id}).`,
    };
  }

  if (accion.clase === "cambiar_estado_lead") {
    const l = await cambiarEstadoLead(tenantId, accion.leadId, accion.estado);
    if (!l) return { ok: false, texto: "Ese lead ya no existe. No se ha hecho nada." };
    return { ok: true, texto: `Hecho. ${accion.etiqueta} pasa a ${ETIQUETA_ESTADO[accion.estado].toLowerCase()}.` };
  }

  return { ok: false, texto: "No sé ejecutar esa acción." };
}
