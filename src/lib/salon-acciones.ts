// Lo que el chat del salón puede HACER, no solo contar — mismo patrón que
// `dental-acciones.ts` y `estetica-acciones.ts`: cada acción se PREPARA (se
// resuelve y se describe en una frase) y no se ejecuta hasta que la dueña dice
// que sí. El modelo nunca toca los datos directamente; como mucho, propone.
//
// AQUÍ NO SE DUPLICA LÓGICA:
//   - Crear una cita va contra `reservarSlot` del orquestador central (mismo
//     motor, mismo candado por negocio y día que la web pública, Pablo, Carmen y
//     Marta), con la profesional y el servicio elegidos.
//   - Mover y cancelar van contra `reprogramarRecord` / `cambiarEstadoRecord`, lo
//     mismo que los botones de la agenda; cancelar avisa a la lista de espera
//     igual que el botón (`avisarHuecoLiberado`).
//   - La lista de espera, contra `crearEspera`.
//   - "Reactivar a una clienta dormida" PREPARA EL MENSAJE. No lo envía: al
//     confirmar, el chat enseña el texto para que lo mande la dueña por WhatsApp,
//     o lo mande el botón "Reactivar" de Clientas si hay email. Ningún envío sale
//     de aquí.

import "server-only";
import {
  getBusinessesForTenant,
  listRecords,
  listEspera,
  crearEspera,
  reprogramarRecord,
  cambiarEstadoRecord,
  empleadosDeServicio,
  emparejarServicio,
  listClientasDormidasCompleto,
  type BookingRecord,
  type BusinessBooking,
  type BookingService,
  type Empleado,
} from "./booking";
import { textoFalloReserva } from "./reserva-texto";
import { avisarHuecoLiberado } from "./booking-liberado";
import { textoReactivacion } from "./salon-textos";
import { pegaDeHueco, citaGuardada, TEXTO_NO_GUARDADA } from "./hueco-panel";

const FOUNDER_EMAIL_FALLBACK = "ecoprimemediterraneo@gmail.com";
const REDIRECT_URI = "https://aiteam.marketing/api/lucia/callback";

export type Preparada =
  | { tipo: "propuesta"; resumen: string; accion: AccionPendiente }
  | { tipo: "ambiguo"; pregunta: string; opciones: string[] }
  | { tipo: "nada"; motivo: string };

/** La acción ya resuelta, lista para ejecutarse en cuanto se diga que sí. */
export type AccionPendiente =
  | { clase: "crear_cita"; tenantId: string; nombre: string; telefono: string; servicioId: string; servicioNombre: string; profesionalId?: string; profesionalNombre?: string; startIso: string; etiqueta: string }
  | { clase: "mover_cita"; tenantId: string; recordId: string; nuevoStartIso: string; etiqueta: string }
  | { clase: "cancelar_cita"; tenantId: string; recordId: string; etiqueta: string }
  | { clase: "apuntar_espera"; tenantId: string; nombre: string; telefono: string; servicioId: string; servicioNombre: string; profesionalId?: string; profesionalNombre?: string; fecha: string; horaPedida?: string; etiqueta: string }
  | { clase: "mensaje_reactivacion"; tenantId: string; key: string; nombre: string; texto: string; etiqueta: string };

// -----------------------------------------------------------------------------
// Utilidades
// -----------------------------------------------------------------------------

const norm = (t: string) => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function fechaNatural(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}
const horaDe = (iso: string) => iso.match(/T(\d{2}:\d{2})/)?.[1] ?? iso;
const cuando = (iso: string) => `${fechaNatural(iso)} a las ${horaDe(iso)}`;

const validaFecha = (f?: string) => !!f && /^\d{4}-\d{2}-\d{2}$/.test(f);
const validaHora = (h?: string) => !!h && /^\d{2}:\d{2}$/.test(h);

/** El servicio del negocio que corresponde a lo que se ha dicho. Coincidencia real: no adivina. */
export function buscarServicio(negocio: BusinessBooking, texto: string): { encontrados: BookingService[] } {
  const q = norm(texto);
  const activos = negocio.servicios.filter((s) => s.activo);
  if (!q) return { encontrados: [] };
  const exacto = activos.filter((s) => norm(s.nombre) === q);
  if (exacto.length) return { encontrados: exacto };
  const contiene = activos.filter((s) => norm(s.nombre).includes(q) || q.includes(norm(s.nombre)));
  if (contiene.length) return { encontrados: contiene };
  const palabras = q.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  return { encontrados: activos.filter((s) => palabras.some((w) => norm(s.nombre).includes(w))) };
}

/** La profesional a la que se refiere el nombre. */
export function buscarProfesional(negocio: BusinessBooking, texto: string): Empleado[] {
  const q = norm(texto);
  if (!q) return [];
  const activos = (negocio.empleados || []).filter((e) => e.activo);
  const exacto = activos.filter((e) => norm(e.nombre) === q);
  if (exacto.length) return exacto;
  return activos.filter((e) => norm(e.nombre).includes(q) || q.includes(norm(e.nombre)));
}

/** Citas ACTIVAS (de hoy en adelante) que encajan con un nombre, teléfono y/o fecha. */
async function citasActivas(negocio: BusinessBooking, quien: string, fecha?: string): Promise<BookingRecord[]> {
  const q = norm(quien);
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: negocio.timezone || "Europe/Madrid" });
  return (await listRecords())
    .filter((r) => r.slug === negocio.slug && r.tipo === "cita" && (r.estado === "confirmada" || r.estado === "pendiente"))
    .filter((r) => r.startIso.slice(0, 10) >= hoy)
    .filter((r) => !fecha || r.startIso.slice(0, 10) === fecha)
    .filter((r) => !q || norm(r.cliente?.nombre || "").includes(q) || (r.cliente?.telefono || "").includes(quien.trim()))
    .sort((a, b) => a.startIso.localeCompare(b.startIso));
}

const describir = (r: BookingRecord) =>
  `${r.cliente?.nombre || "sin nombre"} · ${[r.servicioNombre, r.varianteNombre].filter(Boolean).join(" · ") || "cita"}${r.empleadoNombre ? ` con ${r.empleadoNombre}` : ""} · ${cuando(r.startIso)}`;

async function negocioDe(tenantId: string): Promise<BusinessBooking | null> {
  return (await getBusinessesForTenant(tenantId))[0] ?? null;
}

// -----------------------------------------------------------------------------
// Preparar cada acción
// -----------------------------------------------------------------------------


// La comprobación de hora (pasada, cerrado, fuera de horario) vive en
// `hueco-panel.ts`, compartida con dental y estética.

/**
 * Del texto de la dueña al servicio, SIN cambiarlo por otro parecido: igual →
 * ese; parecidos → se pregunta (aunque sea uno); ninguno → catálogo. Ver
 * `emparejarServicio` en booking.ts.
 */
function servicioDe(negocio: BusinessBooking, texto: string): { servicio: BookingService } | { r: Preparada } {
  const e = emparejarServicio(negocio, texto);
  if (e.tipo === "exacto") return { servicio: e.servicio };
  if (e.tipo === "varios") {
    return { r: { tipo: "ambiguo", pregunta: `"${texto}" no es exactamente ningún servicio del salón. ¿Cuál de estos es? No prepares nada hasta que lo diga.`, opciones: e.opciones.map((s) => s.nombre) } };
  }
  return { r: { tipo: "nada", motivo: `No tengo ningún servicio que se llame "${texto}". Los del salón son: ${e.catalogo.map((s) => s.nombre).join(", ")}.` } };
}

/** "ponle a Marta Ruiz un corte con Ana el jueves a las 10" */
export async function prepararCrearCita(
  tenantId: string,
  args: { nombre?: string; telefono?: string; servicio?: string; profesional?: string; fecha?: string; hora?: string },
): Promise<Preparada> {
  const faltan: string[] = [];
  if (!args.nombre?.trim()) faltan.push("el nombre de la clienta");
  if (!args.servicio?.trim()) faltan.push("el servicio");
  if (!validaFecha(args.fecha)) faltan.push("la fecha (AAAA-MM-DD)");
  if (!validaHora(args.hora)) faltan.push("la hora (HH:mm)");
  if (faltan.length) return { tipo: "nada", motivo: `Para la cita me falta: ${faltan.join(", ")}. Pregúntaselo, no lo inventes.` };

  const negocio = await negocioDe(tenantId);
  if (!negocio) return { tipo: "nada", motivo: "Este salón todavía no tiene una agenda conectada." };

  const sv = servicioDe(negocio, args.servicio!);
  if ("r" in sv) return sv.r;
  const servicio = sv.servicio;

  let prof: Empleado | undefined;
  const equipo = (negocio.empleados || []).filter((e) => e.activo);
  if (args.profesional?.trim()) {
    const ps = buscarProfesional(negocio, args.profesional);
    if (ps.length === 0) {
      return { tipo: "nada", motivo: `No hay ninguna profesional que se llame "${args.profesional}". Las del salón son: ${equipo.map((e) => e.nombre).join(", ")}.` };
    }
    if (ps.length > 1) return { tipo: "ambiguo", pregunta: `Hay varias profesionales que encajan con "${args.profesional}". ¿Cuál?`, opciones: ps.map((e) => e.nombre) };
    prof = ps[0];
    if (!empleadosDeServicio(negocio, servicio.id).some((e) => e.id === prof!.id)) {
      const quienes = empleadosDeServicio(negocio, servicio.id).map((e) => e.nombre);
      return { tipo: "nada", motivo: `${prof.nombre} no hace "${servicio.nombre}". Lo hacen: ${quienes.join(", ") || "nadie ahora mismo"}.` };
    }
  }

  const startIso = `${args.fecha}T${args.hora}:00`;
  const pega = await pegaDeHueco(negocio, startIso, { servicio, prof });
  if (pega) return { tipo: "nada", motivo: pega };
  const nombre = args.nombre!.trim();
  const telefono = (args.telefono || "").trim();
  const etiqueta = `${servicio.nombre} de ${nombre}${prof ? ` con ${prof.nombre}` : ""} el ${cuando(startIso)}`;
  return {
    tipo: "propuesta",
    resumen: `Crear cita: ${etiqueta}.`,
    accion: { clase: "crear_cita", tenantId, nombre, telefono, servicioId: servicio.id, servicioNombre: servicio.nombre, profesionalId: prof?.id, profesionalNombre: prof?.nombre, startIso, etiqueta },
  };
}

/** "pásale la cita de Marta al viernes a las 12" */
export async function prepararMoverCita(
  tenantId: string,
  args: { quien?: string; fechaActual?: string; nuevaFecha?: string; nuevaHora?: string },
): Promise<Preparada> {
  if (!args.quien?.trim()) return { tipo: "nada", motivo: "Dime de qué clienta es la cita que hay que mover." };
  if (!validaFecha(args.nuevaFecha) || !validaHora(args.nuevaHora)) {
    return { tipo: "nada", motivo: "Para mover la cita me falta el día y la hora nuevos (AAAA-MM-DD y HH:mm). Pregúntaselo." };
  }
  const negocio = await negocioDe(tenantId);
  if (!negocio) return { tipo: "nada", motivo: "Este salón todavía no tiene una agenda conectada." };
  const citas = await citasActivas(negocio, args.quien, validaFecha(args.fechaActual) ? args.fechaActual : undefined);
  if (citas.length === 0) return { tipo: "nada", motivo: `No encuentro ninguna cita pendiente de "${args.quien}".` };
  if (citas.length > 1) return { tipo: "ambiguo", pregunta: "Tiene varias citas. ¿Cuál hay que mover?", opciones: citas.map(describir) };
  const r = citas[0];
  const nuevoStartIso = `${args.nuevaFecha}T${args.nuevaHora}:00`;
  const svM = negocio.servicios.find((x) => x.id === r.serviceId);
  const profM = r.empleadoId ? (negocio.empleados || []).find((e) => e.id === r.empleadoId) : undefined;
  if (svM) {
    const pegaM = await pegaDeHueco(negocio, nuevoStartIso, { servicio: svM, prof: profM });
    if (pegaM) return { tipo: "nada", motivo: pegaM };
  }
  if (r.startIso.slice(0, 16) === nuevoStartIso.slice(0, 16)) return { tipo: "nada", motivo: "Esa cita ya está a esa hora. No hay nada que mover." };
  const etiqueta = `${describir(r)} → ${cuando(nuevoStartIso)}`;
  return { tipo: "propuesta", resumen: `Mover la cita: ${etiqueta}.`, accion: { clase: "mover_cita", tenantId, recordId: r.id, nuevoStartIso, etiqueta } };
}

/** "cancela la cita de Marta del jueves" */
export async function prepararCancelarCita(tenantId: string, args: { quien?: string; fecha?: string }): Promise<Preparada> {
  if (!args.quien?.trim()) return { tipo: "nada", motivo: "Dime de qué clienta es la cita que hay que cancelar." };
  const negocio = await negocioDe(tenantId);
  if (!negocio) return { tipo: "nada", motivo: "Este salón todavía no tiene una agenda conectada." };
  const citas = await citasActivas(negocio, args.quien, validaFecha(args.fecha) ? args.fecha : undefined);
  if (citas.length === 0) return { tipo: "nada", motivo: `No encuentro ninguna cita pendiente de "${args.quien}".` };
  if (citas.length > 1) return { tipo: "ambiguo", pregunta: "Tiene varias citas. ¿Cuál hay que cancelar?", opciones: citas.map(describir) };
  const r = citas[0];
  return { tipo: "propuesta", resumen: `Cancelar la cita: ${describir(r)}.`, accion: { clase: "cancelar_cita", tenantId, recordId: r.id, etiqueta: describir(r) } };
}

/** "apunta a Lucía en la lista de espera para un color el viernes" */
export async function prepararApuntarEspera(
  tenantId: string,
  args: { nombre?: string; telefono?: string; servicio?: string; profesional?: string; fecha?: string; hora?: string },
): Promise<Preparada> {
  const faltan: string[] = [];
  if (!args.nombre?.trim()) faltan.push("el nombre");
  if (!args.telefono?.trim() || args.telefono.replace(/\D/g, "").length < 6) faltan.push("el teléfono (sin él no se le puede avisar)");
  if (!args.servicio?.trim()) faltan.push("el servicio");
  if (!validaFecha(args.fecha)) faltan.push("el día que quiere (AAAA-MM-DD)");
  if (faltan.length) return { tipo: "nada", motivo: `Para apuntarla en la lista de espera me falta: ${faltan.join(", ")}. Pregúntaselo, no lo inventes.` };

  const negocio = await negocioDe(tenantId);
  if (!negocio) return { tipo: "nada", motivo: "Este salón todavía no tiene una agenda conectada." };
  const sv = servicioDe(negocio, args.servicio!);
  if ("r" in sv) return sv.r;
  const servicio = sv.servicio;

  let prof: Empleado | undefined;
  if (args.profesional?.trim()) {
    const ps = buscarProfesional(negocio, args.profesional);
    if (ps.length === 0) return { tipo: "nada", motivo: `No hay ninguna profesional que se llame "${args.profesional}".` };
    if (ps.length > 1) return { tipo: "ambiguo", pregunta: "¿Con cuál de ellas?", opciones: ps.map((e) => e.nombre) };
    prof = ps[0];
  }
  const hora = validaHora(args.hora) ? args.hora : undefined;
  const nombre = args.nombre!.trim();
  const etiqueta = `${nombre} · ${servicio.nombre}${prof ? ` con ${prof.nombre}` : ""} · ${fechaNatural(args.fecha!)}${hora ? ` (le iría bien a las ${hora})` : ""}`;
  return {
    tipo: "propuesta",
    resumen: `Apuntar en la lista de espera: ${etiqueta}.`,
    accion: { clase: "apuntar_espera", tenantId, nombre, telefono: args.telefono!.trim(), servicioId: servicio.id, servicioNombre: servicio.nombre, profesionalId: prof?.id, profesionalNombre: prof?.nombre, fecha: args.fecha!, horaPedida: hora, etiqueta },
  };
}

/** "prepárale un mensaje a Marta para que vuelva" */
export async function prepararMensajeReactivacion(tenantId: string, args: { quien?: string }): Promise<Preparada> {
  if (!args.quien?.trim()) return { tipo: "nada", motivo: "Dime a qué clienta hay que escribirle." };
  const negocio = await negocioDe(tenantId);
  if (!negocio) return { tipo: "nada", motivo: "Este salón todavía no tiene una agenda conectada." };
  const q = norm(args.quien);
  const dormidas = (await listClientasDormidasCompleto(negocio.slug)).filter((d) => norm(d.nombre).includes(q) || (d.telefono || "").includes(args.quien!.trim()));
  if (dormidas.length === 0) return { tipo: "nada", motivo: `No hay ninguna clienta dormida que encaje con "${args.quien}". Dormida = venía y lleva más de 60 días sin volver ni tener cita.` };
  if (dormidas.length > 1) return { tipo: "ambiguo", pregunta: "Hay varias clientas dormidas que encajan. ¿A cuál?", opciones: dormidas.map((d) => `${d.nombre} · ${d.diasSinVenir} días sin venir`) };
  const d = dormidas[0];
  const texto = textoReactivacion(d.nombre, negocio.nombre, d.diasSinVenir, d.servicioHabitual, d.profesionalHabitual);
  return {
    tipo: "propuesta",
    resumen: `Preparar el mensaje para que vuelva ${d.nombre} (${d.diasSinVenir} días sin venir). No se envía nada: te lo enseño para que lo mandes tú.`,
    accion: { clase: "mensaje_reactivacion", tenantId, key: d.key, nombre: d.nombre, texto, etiqueta: d.nombre },
  };
}

// -----------------------------------------------------------------------------
// Ejecutar — SOLO se llama tras la confirmación explícita del usuario
// -----------------------------------------------------------------------------

export type ResultadoEjecucion = { ok: boolean; texto: string };

function textoFalloMover(r: { reason: string }): string {
  switch (r.reason) {
    case "slot_taken": return "Esa hora no está libre para esa profesional, no se ha movido la cita. Prueba con otra.";
    case "locked": return "Justo ahora se estaba reservando esa hora. Vuelve a intentarlo en unos segundos.";
    case "no_movible": return "Esa cita ya no se puede mover (está cancelada o ya pasó).";
    case "not_found": return "Esa cita ya no existe. No se ha hecho nada.";
    default: return "No se ha podido mover la cita ahora mismo. Inténtalo otra vez en un minuto.";
  }
}

export async function ejecutar(tenantId: string, accion: AccionPendiente): Promise<ResultadoEjecucion> {
  // Blindaje de tenant: la acción lleva SU tenantId de cuando se preparó, y
  // aquí se comprueba contra el tenant de quien confirma.
  if (accion.tenantId !== tenantId) {
    return { ok: false, texto: "Esta propuesta no es de este salón. No se ha hecho nada." };
  }
  const negocio = await negocioDe(tenantId);
  if (!negocio) return { ok: false, texto: "Este salón todavía no tiene una agenda conectada." };

  if (accion.clase === "crear_cita") {
    // Se vuelve a mirar al CONFIRMAR: la propuesta pudo quedarse en pantalla y
    // la hora pasar mientras tanto.
    const sv = negocio.servicios.find((x) => x.id === accion.servicioId);
    const prof = accion.profesionalId ? (negocio.empleados || []).find((e) => e.id === accion.profesionalId) : undefined;
    const pega = await pegaDeHueco(negocio, accion.startIso, { servicio: sv, prof });
    if (pega) return { ok: false, texto: `No se ha creado la cita. ${pega}` };
    const { reservarSlot } = await import("./orchestrator");
    const res = await reservarSlot({
      tenantId,
      userEmail: process.env.FOUNDER_EMAIL || FOUNDER_EMAIL_FALLBACK,
      redirectUri: REDIRECT_URI,
      nombre: accion.nombre,
      motivo: accion.servicioNombre,
      startIso: accion.startIso,
      agenteOrigen: "dashboard",
      customerPhone: accion.telefono || undefined,
      empleadoId: accion.profesionalId,
      // El servicio que se confirmó, por id: no se vuelve a deducir del texto.
      serviceId: accion.servicioId,
    });
    if (!res.ok) return { ok: false, texto: textoFalloReserva(res) };
    // «Creada» SOLO si está en la agenda: el texto sale de lo guardado.
    const g = await citaGuardada(res, negocio.slug);
    if (!g) return { ok: false, texto: TEXTO_NO_GUARDADA };
    return { ok: true, texto: `Hecho. Cita creada: ${accion.etiqueta}. Ya está en la agenda.` };
  }

  if (accion.clase === "mover_cita") {
    const pegaM = await pegaDeHueco(negocio, accion.nuevoStartIso);
    if (pegaM) return { ok: false, texto: `No se ha movido la cita. ${pegaM}` };
    const r = await reprogramarRecord(accion.recordId, accion.nuevoStartIso, undefined, REDIRECT_URI, negocio.slug);
    if (r.ok) {
      const ya = (await listRecords()).find((x) => x.id === accion.recordId);
      if (!ya || ya.startIso.slice(0, 16) !== accion.nuevoStartIso.slice(0, 16)) {
        return { ok: false, texto: "La agenda no ha guardado el cambio, así que la cita NO se ha movido. Inténtalo otra vez desde la Agenda." };
      }
      return { ok: true, texto: `Hecho. Cita movida: ${accion.etiqueta}.` };
    }
    return { ok: false, texto: textoFalloMover(r) };
  }

  if (accion.clase === "cancelar_cita") {
    const r = await cambiarEstadoRecord(accion.recordId, "cancelada", REDIRECT_URI, negocio.slug);
    if (!r.ok) {
      return { ok: false, texto: r.reason === "not_found" ? "Esa cita ya no existe. No se ha hecho nada." : "No se ha podido cancelar la cita ahora mismo. Inténtalo otra vez en un minuto." };
    }
    await avisarHuecoLiberado(r.record, "https://aiteam.marketing", REDIRECT_URI);
    return { ok: true, texto: `Hecho. Cita cancelada: ${accion.etiqueta}. El hueco queda libre y se avisa a la lista de espera de ese día.` };
  }

  if (accion.clase === "apuntar_espera") {
    const r = await crearEspera({
      slug: negocio.slug,
      serviceId: accion.servicioId,
      empleadoId: accion.profesionalId,
      fecha: accion.fecha,
      cliente: { nombre: accion.nombre, telefono: accion.telefono },
      horaPedida: accion.horaPedida,
    });
    if (!r.ok) return { ok: false, texto: "No se ha podido apuntar: ese servicio ya no existe en el salón." };
    return { ok: true, texto: `Hecho. Apuntada en la lista de espera: ${accion.etiqueta} (id ${r.entry.id}).` };
  }

  if (accion.clase === "mensaje_reactivacion") {
    return {
      ok: true,
      texto:
        `Aquí tienes el mensaje para ${accion.nombre}. No he enviado nada:\n\n"${accion.texto}"\n\n` +
        `Cópialo y mándalo tú por WhatsApp. Si tiene email, también puedes usar el botón «Reactivar» en Clientas.`,
    };
  }

  return { ok: false, texto: "No sé ejecutar esa acción." };
}

/** Cuántas hay esperando: lo usa la portada y la pestaña. */
export async function contarEspera(slug: string): Promise<number> {
  return (await listEspera(slug)).filter((e) => e.estado === "esperando").length;
}
