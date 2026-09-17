// Lo que el chat de dental puede HACER, no solo contar — mismo patrón que
// `gestoria-acciones.ts`: cada acción se PREPARA (se resuelve y se describe en
// una frase) y no se ejecuta hasta que el dueño de la clínica dice que sí. El
// modelo nunca toca los datos directamente; como mucho, propone.
//
// AQUÍ NO SE DUPLICA LÓGICA. Cada acción llama a lo que ya existe:
// `reservarSlot` del orquestador central para citas (mismo motor, mismo
// candado que usan Pablo y Marta — nunca un camino paralelo), `crearPresupuesto`
// / `cambiarEstado` de `presupuestos.ts`, `avisarRecall` de `recall.ts`.

import "server-only";
import { getBusinessesForTenant } from "./booking";
import { crearPresupuesto, cambiarEstado, buscarPresupuestos, type Presupuesto } from "./presupuestos";
import { candidatosRecall, marcarRevisionAvisadaManual, type CandidatoRecall } from "./recall";
import { programarAviso } from "./recall-programado";

const FOUNDER_EMAIL_FALLBACK = "ecoprimemediterraneo@gmail.com";
const REDIRECT_URI = "https://aiteam.marketing/api/lucia/callback";

export type Preparada =
  | { tipo: "propuesta"; resumen: string; accion: AccionPendiente }
  | { tipo: "ambiguo"; pregunta: string; opciones: string[] }
  | { tipo: "nada"; motivo: string };

/** La acción ya resuelta, lista para ejecutarse en cuanto el dueño diga que sí. */
export type AccionPendiente =
  | { clase: "crear_cita"; tenantId: string; nombre: string; telefono: string; tratamiento: string; startIso: string; etiqueta: string }
  | { clase: "crear_presupuesto"; tenantId: string; nombre: string; telefono: string; concepto: string; importeEUR?: number; etiqueta: string }
  | { clase: "cambiar_estado_presupuesto"; tenantId: string; presupuestoId: string; estado: "aceptado" | "rechazado"; etiqueta: string }
  | { clase: "avisar_revision"; tenantId: string; candidato: CandidatoRecall; modo: "enviado" | "programado"; fechaProgramada?: string; etiqueta: string };

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

function encaja(texto: string, ...campos: Array<string | null | undefined>): boolean {
  const t = norm(texto);
  if (!t) return false;
  return campos.some((c) => {
    const n = norm(c || "");
    return !!n && (n.includes(t) || t.includes(n));
  });
}

function fechaNatural(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

// -----------------------------------------------------------------------------
// Preparar cada acción
// -----------------------------------------------------------------------------

/** "pon cita a María Ferrer el jueves a las 10 para una revisión" */
export async function prepararCrearCita(
  tenantId: string,
  args: { nombre?: string; telefono?: string; tratamiento?: string; fecha?: string; hora?: string },
): Promise<Preparada> {
  const faltan: string[] = [];
  if (!args.nombre?.trim()) faltan.push("el nombre del paciente");
  if (!args.tratamiento?.trim()) faltan.push("el tratamiento");
  if (!args.fecha?.trim()) faltan.push("la fecha");
  if (!args.hora?.trim()) faltan.push("la hora");
  if (faltan.length) {
    return { tipo: "nada", motivo: `Para la cita me falta: ${faltan.join(", ")}. Pregúntaselo.` };
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

/** "apúntale un presupuesto a Carlos Ruiz de implante, 1200 euros" */
export async function prepararCrearPresupuesto(
  tenantId: string,
  args: { nombre?: string; telefono?: string; tratamiento?: string; importeEUR?: number },
): Promise<Preparada> {
  const faltan: string[] = [];
  if (!args.nombre?.trim()) faltan.push("el nombre del paciente");
  if (!args.tratamiento?.trim()) faltan.push("el tratamiento");
  if (faltan.length) {
    return { tipo: "nada", motivo: `Para el presupuesto me falta: ${faltan.join(", ")}. Pregúntaselo.` };
  }

  const nombre = args.nombre!.trim();
  const telefono = (args.telefono || "").trim();
  const concepto = args.tratamiento!.trim();
  const importeEUR = typeof args.importeEUR === "number" && args.importeEUR > 0 ? args.importeEUR : undefined;
  const etiqueta = `${concepto} para ${nombre}${importeEUR ? `, ${importeEUR.toLocaleString("es-ES")} €` : ""}`;

  return {
    tipo: "propuesta",
    resumen: `Apuntar presupuesto: ${etiqueta}.`,
    accion: { clase: "crear_presupuesto", tenantId, nombre, telefono, concepto, importeEUR, etiqueta },
  };
}

/** "el presupuesto de María ya lo ha aceptado" / "Carlos ha dicho que no" */
export async function prepararCambiarEstadoPresupuesto(
  tenantId: string,
  paciente: string,
  estado: "aceptado" | "rechazado",
): Promise<Preparada> {
  if (!paciente?.trim()) {
    return { tipo: "nada", motivo: "Dime de qué paciente es el presupuesto." };
  }
  const encontrados = (await buscarPresupuestos(tenantId, paciente)).filter((p) => p.estado === "pendiente" || p.estado === "caducado");
  if (!encontrados.length) {
    return { tipo: "nada", motivo: `No encuentro ningún presupuesto pendiente de "${paciente}".` };
  }
  if (encontrados.length > 1) {
    return {
      tipo: "ambiguo",
      pregunta: "Hay varios presupuestos que encajan. ¿Cuál de estos?",
      opciones: encontrados.map((p: Presupuesto) => `${p.concepto} de ${p.paciente.nombre}${typeof p.importeEUR === "number" ? ` (${p.importeEUR} €)` : ""}`),
    };
  }
  const p = encontrados[0];
  const verbo = estado === "aceptado" ? "Aceptar" : "Rechazar";
  const etiqueta = `${p.concepto} de ${p.paciente.nombre}`;
  return {
    tipo: "propuesta",
    resumen: `${verbo} el presupuesto de ${etiqueta}.`,
    accion: { clase: "cambiar_estado_presupuesto", tenantId, presupuestoId: p.id, estado, etiqueta },
  };
}

/**
 * "márcale aviso de revisión a Pedro" (modo "enviado" — ya le has avisado tú,
 * por teléfono o en persona) o "prográmame avisar a Pedro el día 20" (modo
 * "programado" — todavía no, pero quieres que quede anotado para esa fecha).
 */
export async function prepararAvisarRevision(
  tenantId: string,
  paciente: string,
  modo: "enviado" | "programado" = "enviado",
  fechaProgramada?: string,
): Promise<Preparada> {
  if (!paciente?.trim()) {
    return { tipo: "nada", motivo: "Dime de qué paciente." };
  }
  if (modo === "programado" && !fechaProgramada?.trim()) {
    return { tipo: "nada", motivo: "Para programarlo necesito una fecha (AAAA-MM-DD). Pregúntasela." };
  }
  if (modo === "programado" && fechaProgramada && !/^\d{4}-\d{2}-\d{2}$/.test(fechaProgramada)) {
    return { tipo: "nada", motivo: `"${fechaProgramada}" no es una fecha válida (AAAA-MM-DD). Pregunta de nuevo.` };
  }
  const candidatos = await candidatosRecall(tenantId, { incluirAvisados: true });
  const encontrados = candidatos.filter((c) => encaja(paciente, c.nombre));
  if (!encontrados.length) {
    return {
      tipo: "nada",
      motivo: `"${paciente}" no le toca revisión ahora mismo (o no tiene historial de visitas en la agenda), así que no hay nada que avisar.`,
    };
  }
  if (encontrados.length > 1) {
    return {
      tipo: "ambiguo",
      pregunta: "Hay varios que encajan. ¿Cuál de estos?",
      opciones: encontrados.map((c) => `${c.nombre} · ${c.motivo} · ${c.diasDeRetraso} días de retraso`),
    };
  }
  const c = encontrados[0];
  const etiqueta = `${c.nombre} (${c.motivo}, ${c.diasDeRetraso} días de retraso)`;
  const resumen =
    modo === "enviado"
      ? `Marcar como avisado a ${etiqueta}.`
      : `Programar el aviso de ${etiqueta} para el ${fechaNatural(fechaProgramada!)}.`;
  return {
    tipo: "propuesta",
    resumen,
    accion: { clase: "avisar_revision", tenantId, candidato: c, modo, fechaProgramada, etiqueta },
  };
}

// -----------------------------------------------------------------------------
// Ejecutar — SOLO se llama tras la confirmación explícita del usuario
// -----------------------------------------------------------------------------

export type ResultadoEjecucion = { ok: boolean; texto: string };

export async function ejecutar(tenantId: string, accion: AccionPendiente): Promise<ResultadoEjecucion> {
  // Blindaje de tenant: la acción lleva SU tenantId de cuando se preparó, y
  // aquí se comprueba contra el tenant de quien confirma. Si no coinciden —el
  // panel de otro se ha colado por lo que sea— no se ejecuta nada.
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
      return { ok: false, texto: `Ese hueco ya está ocupado, no se ha creado la cita. Prueba con otra hora.` };
    }
    return { ok: false, texto: `No se ha podido crear la cita: ${res.detail}.` };
  }

  if (accion.clase === "crear_presupuesto") {
    const p = await crearPresupuesto({
      tenantId,
      paciente: { nombre: accion.nombre, telefono: accion.telefono },
      concepto: accion.concepto,
      importeEUR: accion.importeEUR,
    });
    return { ok: true, texto: `Hecho. Presupuesto apuntado: ${accion.etiqueta} (id ${p.id}).` };
  }

  if (accion.clase === "cambiar_estado_presupuesto") {
    const p = await cambiarEstado(tenantId, accion.presupuestoId, accion.estado);
    if (!p) return { ok: false, texto: "Ese presupuesto ya no existe. No se ha hecho nada." };
    return { ok: true, texto: `Hecho. Presupuesto ${accion.estado === "aceptado" ? "aceptado" : "rechazado"}: ${accion.etiqueta}.` };
  }

  if (accion.clase === "avisar_revision") {
    if (accion.modo === "programado") {
      await programarAviso(tenantId, accion.candidato.clave, accion.fechaProgramada!, undefined);
      return { ok: true, texto: `Hecho. Programado el aviso de ${accion.etiqueta} para el ${fechaNatural(accion.fechaProgramada!)}.` };
    }
    // "enviado": se marca a mano, SIN mandar ningún WhatsApp — el dentista
    // confirma que ya se lo ha dicho él mismo (llamada, en persona…). Cuenta
    // para el KPI "revisiones recuperadas" igual que un aviso automático.
    await marcarRevisionAvisadaManual(tenantId, accion.candidato);
    return { ok: true, texto: `Hecho. Marcado como avisado: ${accion.etiqueta}.` };
  }

  return { ok: false, texto: "No sé ejecutar esa acción." };
}
