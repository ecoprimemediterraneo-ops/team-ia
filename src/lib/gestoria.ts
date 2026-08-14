// =============================================================================
// GESTORÍA — expedientes, documentación pendiente y calendario fiscal.
// =============================================================================
//
// Lo que una gestoría tiene y los otros cuatro sectores no. Mismo criterio que
// `restaurante.ts`: módulo PURO en su lógica (sin disco ni red en las funciones
// de cálculo) para que lo puedan usar el servidor, el panel y una prueba.
//
// POR QUÉ ESTE MÓDULO EXISTE. Los dolores del sector están medidos y son tres,
// siempre los mismos: el teléfono saturado con las mismas preguntas, el cliente
// que no manda la documentación, y "¿cómo va lo mío?". Las tres se contestan con
// el mismo dato —el EXPEDIENTE— y por eso el expediente es la pieza central.
//
// Un expediente NO es una cita: no ocupa un hueco en la agenda ni pasa por el
// orquestador de reservas. Es un trámite con estado que dura semanas. Por eso
// tiene su propio almacén y no se mete a la fuerza en `BookingRecord`.

import "server-only";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";
import fs from "node:fs/promises";
import path from "node:path";

// -----------------------------------------------------------------------------
// Modelo
// -----------------------------------------------------------------------------

/** Los cinco trámites del sector. Son datos, no un enum cerrado del negocio. */
export type TramiteId =
  | "renta"
  | "nominas"
  | "autonomos"
  | "trimestrales"
  | "sociedades";

export const TRAMITES: { id: TramiteId; nombre: string; precioEUR: number }[] = [
  { id: "renta", nombre: "Declaración de la renta", precioEUR: 60 },
  { id: "nominas", nombre: "Nóminas y seguros sociales", precioEUR: 45 },
  { id: "autonomos", nombre: "Alta o baja de autónomo", precioEUR: 50 },
  { id: "trimestrales", nombre: "Impuestos trimestrales", precioEUR: 75 },
  { id: "sociedades", nombre: "Constitución de sociedad", precioEUR: 350 },
];

export const tramiteById = (id: string) => TRAMITES.find((t) => t.id === id);

/**
 * Estados de un expediente, en el orden en que ocurren.
 *
 * "esperando_documentacion" está a propósito ANTES de "en_curso": es el estado
 * en el que se atasca la mitad del trabajo de una gestoría, y separarlo es lo
 * que permite reclamar solo a quien toca.
 */
export type EstadoExpediente =
  | "recibido"
  | "esperando_documentacion"
  | "en_curso"
  | "presentado"
  | "cerrado";

export const ESTADO_LABEL: Record<EstadoExpediente, string> = {
  recibido: "Recibido",
  esperando_documentacion: "Falta documentación",
  en_curso: "En curso",
  presentado: "Presentado",
  cerrado: "Cerrado",
};

/** Lo que el cliente lee cuando pregunta "¿cómo va lo mío?". */
export const ESTADO_PARA_CLIENTE: Record<EstadoExpediente, string> = {
  recibido: "lo tenemos recibido y entra en cola",
  esperando_documentacion: "está parado a la espera de documentación tuya",
  en_curso: "lo estamos preparando",
  presentado: "ya está presentado",
  cerrado: "está cerrado",
};

export type DocumentoPendiente = {
  id: string;
  nombre: string;
  /** ISO del último recordatorio enviado. Ausente = todavía no se ha reclamado. */
  reclamadoEn?: string;
  recibido?: boolean;
};

export type Expediente = {
  id: string;
  tenantId: string;
  /** Teléfono del cliente: es la clave con la que pregunta por WhatsApp. */
  telefono: string;
  /** Email, si se conoce. Decide el canal del aviso cuando no hay teléfono. */
  email?: string;
  clienteNombre: string;
  tramite: TramiteId;
  estado: EstadoExpediente;
  /** Periodo al que se refiere ("2025", "1T 2026"). Lo que el cliente nombra. */
  periodo?: string;
  documentos: DocumentoPendiente[];
  /** Fecha límite del trámite, si la tiene. "YYYY-MM-DD". */
  vence?: string;
  nota?: string;
  creadoEn: string;
  actualizadoEn: string;
};

// -----------------------------------------------------------------------------
// Almacén — mismo patrón que el resto: Supabase kv y fallback a JSON local
// -----------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "gestoria-expedientes.json");
const KV_KEY = (tenantId: string) => `gestoria:expedientes:${tenantId}`;
type Mapa = Record<string, Expediente[]>;

export async function listarExpedientes(tenantId: string): Promise<Expediente[]> {
  if (supabaseEnabled()) return (await kvGet<Expediente[]>(KV_KEY(tenantId))) ?? [];
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
    const all = raw.trim() ? (JSON.parse(raw) as Mapa) : {};
    return all[tenantId] ?? [];
  } catch {
    return [];
  }
}

export async function guardarExpedientes(tenantId: string, lista: Expediente[]): Promise<void> {
  if (supabaseEnabled()) {
    await kvSet(KV_KEY(tenantId), lista);
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
  const all = raw.trim() ? (JSON.parse(raw) as Mapa) : {};
  all[tenantId] = lista;
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

// -----------------------------------------------------------------------------
// (a) ESTADO DEL EXPEDIENTE — la función principal
// -----------------------------------------------------------------------------

const soloDigitos = (t: string) => (t || "").replace(/\D/g, "");

/** Los expedientes vivos de ese teléfono, del más reciente al más antiguo. */
export function expedientesDe(lista: Expediente[], telefono: string): Expediente[] {
  const clave = soloDigitos(telefono);
  if (!clave) return [];
  return lista
    .filter((e) => soloDigitos(e.telefono) === clave && e.estado !== "cerrado")
    .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
}

/**
 * La respuesta a "¿cómo va lo mío?", ya redactada.
 *
 * Devuelve null si no hay nada que contar: sin expediente, el agente NO se
 * inventa un estado, dice que lo mira una persona. Es la diferencia entre
 * quitar una llamada y provocar una reclamación.
 */
export function textoEstado(expedientes: Expediente[]): string | null {
  if (!expedientes.length) return null;

  const linea = (e: Expediente) => {
    const nombre = tramiteById(e.tramite)?.nombre ?? e.tramite;
    const periodo = e.periodo ? ` (${e.periodo})` : "";
    let t = `${nombre}${periodo}: ${ESTADO_PARA_CLIENTE[e.estado]}`;
    const faltan = e.documentos.filter((d) => !d.recibido);
    if (e.estado === "esperando_documentacion" && faltan.length) {
      t += `. Nos falta: ${faltan.map((d) => d.nombre).join(", ")}`;
    }
    if (e.vence && e.estado !== "presentado") t += `. Vence el ${fechaCorta(e.vence)}`;
    return t;
  };

  if (expedientes.length === 1) return linea(expedientes[0]);
  return expedientes.slice(0, 3).map((e) => `· ${linea(e)}`).join("\n");
}

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-");
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${Number(d)} de ${meses[Number(m) - 1] ?? m}${y ? ` de ${y}` : ""}`;
}

/** ¿El mensaje del cliente es un "¿cómo va lo mío?"? */
export function preguntaPorEstado(texto: string): boolean {
  const t = (texto || "").toLowerCase();
  return /\b(c[oó]mo va|qu[eé] tal va|en qu[eé] punto|se ha presentado|ya est[aá] presentad|novedades|estado de mi|mi expediente|lo m[ií]o)\b/.test(t);
}

// -----------------------------------------------------------------------------
// (b) RECLAMACIÓN DE DOCUMENTACIÓN
// -----------------------------------------------------------------------------

/** A los 3 días sin recibir el documento, se vuelve a insistir. */
export const DIAS_ENTRE_RECLAMACIONES = 3;

/** Envío real de la reclamación por WhatsApp. FAIL-CLOSED, como todo lo demás. */
export const reclamacionDocsEnabled = (): boolean =>
  (process.env.GESTORIA_DOCS_SEND_ENABLED || "").toLowerCase() === "true";

/** Avisos de vencimientos del calendario fiscal. FAIL-CLOSED. */
export const calendarioFiscalEnabled = (): boolean =>
  (process.env.GESTORIA_FISCAL_SEND_ENABLED || "").toLowerCase() === "true";

export type ReclamacionPendiente = {
  expediente: Expediente;
  documentos: DocumentoPendiente[];
  /** true si ya se reclamó antes y toca insistir. */
  esRecordatorio: boolean;
  texto: string;
};

/**
 * A quién habría que reclamarle documentación HOY.
 *
 * Función pura: se le pasa la lista y la fecha, y decide. Quien envía es otro,
 * y solo si el flag está encendido.
 */
export function reclamacionesPendientes(
  lista: Expediente[],
  ahora: Date = new Date(),
): ReclamacionPendiente[] {
  const out: ReclamacionPendiente[] = [];
  for (const e of lista) {
    if (e.estado !== "esperando_documentacion") continue;
    const faltan = e.documentos.filter((d) => !d.recibido);
    if (!faltan.length) continue;

    // La más reciente de las reclamaciones manda: si a UNO de los documentos se
    // le reclamó ayer, no se vuelve a escribir hoy por otro del mismo expediente.
    const ultima = faltan
      .map((d) => d.reclamadoEn)
      .filter((x): x is string => !!x)
      .sort()
      .pop();

    let esRecordatorio = false;
    if (ultima) {
      const dias = (ahora.getTime() - new Date(ultima).getTime()) / 86_400_000;
      if (dias < DIAS_ENTRE_RECLAMACIONES) continue;
      esRecordatorio = true;
    }

    const nombre = tramiteById(e.tramite)?.nombre ?? e.tramite;
    const listaDocs = faltan.map((d) => d.nombre).join(", ");
    out.push({
      expediente: e,
      documentos: faltan,
      esRecordatorio,
      texto: esRecordatorio
        ? `Hola ${e.clienteNombre}, te recordamos que para ${nombre} seguimos esperando: ${listaDocs}. En cuanto lo tengamos, lo sacamos.`
        : `Hola ${e.clienteNombre}, para ${nombre} nos falta: ${listaDocs}. Puedes mandarlo por aquí mismo.`,
    });
  }
  return out;
}

// -----------------------------------------------------------------------------
// (c) CALENDARIO FISCAL
// -----------------------------------------------------------------------------

export type Vencimiento = {
  id: string;
  nombre: string;
  /** "MM-DD": se repite todos los años. */
  diaMes: string;
  /** Qué trámites lo tienen; solo se avisa a quien tenga alguno. */
  aplicaA: TramiteId[];
};

/**
 * Los vencimientos generales del calendario fiscal español. Son DATOS y están
 * aquí para poder editarlos sin tocar código; no se avisa a todo el mundo de
 * todo, sino a quien tiene ese trámite contratado.
 */
export const VENCIMIENTOS: Vencimiento[] = [
  { id: "1t", nombre: "Impuestos del primer trimestre", diaMes: "04-20", aplicaA: ["trimestrales"] },
  { id: "2t", nombre: "Impuestos del segundo trimestre", diaMes: "07-20", aplicaA: ["trimestrales"] },
  { id: "3t", nombre: "Impuestos del tercer trimestre", diaMes: "10-20", aplicaA: ["trimestrales"] },
  { id: "4t", nombre: "Impuestos del cuarto trimestre", diaMes: "01-30", aplicaA: ["trimestrales"] },
  { id: "renta", nombre: "Fin del plazo de la declaración de la renta", diaMes: "06-30", aplicaA: ["renta"] },
];

/** Con cuántos días de antelación se avisa. */
export const DIAS_AVISO_VENCIMIENTO = 7;

export type AvisoVencimiento = { telefono: string; clienteNombre: string; texto: string; vencimiento: Vencimiento };

/** Quién debería recibir hoy un aviso de vencimiento. Puro: no envía nada. */
export function avisosDeVencimiento(
  lista: Expediente[],
  ahora: Date = new Date(),
): AvisoVencimiento[] {
  const out: AvisoVencimiento[] = [];
  const yyyy = ahora.getUTCFullYear();

  for (const v of VENCIMIENTOS) {
    const [mm, dd] = v.diaMes.split("-").map(Number);
    const fecha = Date.UTC(yyyy, mm - 1, dd);
    const dias = Math.round((fecha - Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate())) / 86_400_000);
    if (dias !== DIAS_AVISO_VENCIMIENTO) continue;

    // Un aviso por cliente, no uno por expediente: tres trimestrales del mismo
    // cliente no son tres WhatsApps.
    const vistos = new Set<string>();
    for (const e of lista) {
      if (!v.aplicaA.includes(e.tramite)) continue;
      if (e.estado === "cerrado") continue;
      const clave = soloDigitos(e.telefono);
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      out.push({
        telefono: e.telefono,
        clienteNombre: e.clienteNombre,
        vencimiento: v,
        texto: `Hola ${e.clienteNombre}, te avisamos de que en ${DIAS_AVISO_VENCIMIENTO} días vence ${v.nombre.toLowerCase()}. Si nos falta algo tuyo, dínoslo por aquí.`,
      });
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// Resumen para el panel
// -----------------------------------------------------------------------------

export type ResumenExpedientes = {
  total: number;
  porEstado: Record<EstadoExpediente, number>;
  esperandoDocs: number;
  documentosPendientes: number;
  venceEstaSemana: number;
};

export function resumenExpedientes(lista: Expediente[], ahora: Date = new Date()): ResumenExpedientes {
  const porEstado = {
    recibido: 0, esperando_documentacion: 0, en_curso: 0, presentado: 0, cerrado: 0,
  } as Record<EstadoExpediente, number>;
  let documentosPendientes = 0;
  let venceEstaSemana = 0;
  const limite = new Date(ahora.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const hoy = ahora.toISOString().slice(0, 10);

  for (const e of lista) {
    porEstado[e.estado] = (porEstado[e.estado] ?? 0) + 1;
    documentosPendientes += e.documentos.filter((d) => !d.recibido).length;
    if (e.vence && e.vence >= hoy && e.vence <= limite && e.estado !== "presentado" && e.estado !== "cerrado") {
      venceEstaSemana += 1;
    }
  }
  return {
    total: lista.length,
    porEstado,
    esperandoDocs: porEstado.esperando_documentacion,
    documentosPendientes,
    venceEstaSemana,
  };
}
