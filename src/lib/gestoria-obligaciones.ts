// LA AGENDA DE UN GESTOR: lo que se le olvida, no a quién recibe.
//
// La pestaña Agenda venía del módulo de peluquería: franjas horarias, huecos,
// "reservar cita". Un gestor no tiene citas. Lo que un gestor tiene son fechas
// límite legales, y lo que le cuesta dinero es pasársele una.
//
// DOS REGLAS QUE LO ORDENAN TODO
// ------------------------------
// 1. NO SE RELLENA A MANO. Si hay que teclearla, Jose no la usa y la agenda
//    miente a la semana. Todo sale solo: los modelos trimestrales de lo que cada
//    cliente tiene marcado, los requerimientos del correo que lee Eva, las
//    facturas que faltan del estado real de las facturas.
// 2. NO SE GUARDA LO QUE YA VIVE EN OTRO SITIO. Igual que en HOY: lo derivado se
//    calcula en cada lectura. Una copia se queda vieja y acaba diciéndole al
//    gestor que haga algo que ya hizo.
//
// ESTO NO ES UN SISTEMA NUEVO. Es una segunda VISTA del modelo de HOY: la misma
// `Tarea`, el mismo almacén de hechos, el mismo orden. HOY contesta "¿qué hago
// ahora?"; la Agenda contesta "¿qué se me viene encima?". Dos preguntas, un
// modelo — si fueran dos sistemas, marcar algo hecho en uno lo dejaría vivo en
// el otro.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";
import { hoyMadrid, diasHasta, hechosDe, type Tarea } from "./gestoria-hoy";
import { listarIdentidades } from "./gestoria-identidad";
import { listarClientes } from "./gestoria-clientes";
import { listarFacturas } from "./gestoria-facturas";

// -----------------------------------------------------------------------------
// Los modelos trimestrales
// -----------------------------------------------------------------------------

/**
 * Los cuatro que presenta cada trimestre una gestoría pequeña.
 *
 * No están todos los que existen: están los que Jose presenta cada tres meses
 * para casi todos sus clientes. Una lista larga de casillas es una lista que no
 * se marca.
 */
export const MODELOS_TRIMESTRALES = [
  { id: "111", nombre: "Modelo 111", queEs: "Retenciones de trabajo y profesionales" },
  { id: "115", nombre: "Modelo 115", queEs: "Retenciones de alquileres" },
  { id: "303", nombre: "Modelo 303", queEs: "IVA del trimestre" },
  { id: "130", nombre: "Modelo 130", queEs: "Pago fraccionado de IRPF" },
] as const;

export type ModeloId = (typeof MODELOS_TRIMESTRALES)[number]["id"];

export const esModelo = (v: string): v is ModeloId =>
  MODELOS_TRIMESTRALES.some((m) => m.id === v);

/**
 * El día 20 del mes siguiente al trimestre. Enero, abril, julio y octubre.
 *
 * Se deja la fecha "de libro" a propósito, sin mover por fines de semana ni por
 * festivos: cuando el 20 cae en sábado Hacienda amplía, pero adelantar el aviso
 * nunca hace daño y retrasarlo sí. Y el que domicilia el pago tiene cinco días
 * MENOS, así que la fecha buena para un gestor es siempre la temprana.
 */
export function vencimientosDelAño(año: number): Array<{ periodo: string; vence: string }> {
  return [
    { periodo: `4T ${año - 1}`, vence: `${año}-01-20` },
    { periodo: `1T ${año}`, vence: `${año}-04-20` },
    { periodo: `2T ${año}`, vence: `${año}-07-20` },
    { periodo: `3T ${año}`, vence: `${año}-10-20` },
  ];
}

/**
 * Los vencimientos que todavía importan: el próximo de cada trimestre y el que
 * acaba de pasar sin presentarse.
 *
 * Se miran doce meses, no el año natural: en diciembre lo que viene es el 20 de
 * enero, y una agenda que se vacía en Nochebuena no sirve de nada.
 */
export function vencimientosVigentes(hoy = hoyMadrid()): Array<{ periodo: string; vence: string }> {
  const año = Number(hoy.slice(0, 4));
  return [...vencimientosDelAño(año), ...vencimientosDelAño(año + 1)]
    .filter((v) => {
      const d = diasHasta(v.vence);
      // Desde 15 días pasados (por si se presentó tarde) hasta 120 por delante.
      return d !== null && d >= -15 && d <= 120;
    })
    .sort((a, b) => a.vence.localeCompare(b.vence));
}

// -----------------------------------------------------------------------------
// Días hábiles: lo que convierte "diez días" en una fecha
// -----------------------------------------------------------------------------

/**
 * Festivos nacionales fijos. Los autonómicos y locales NO están, y es una
 * limitación de verdad: en Andalucía el 28 de febrero es festivo y aquí cuenta
 * como hábil, así que la fecha puede salir un día antes de la real.
 *
 * Se prefiere errar por lo temprano: una obligación que aparece un día antes de
 * lo que toca es un aviso de más; una que aparece un día tarde es una sanción.
 */
const FESTIVOS_FIJOS = ["01-01", "01-06", "05-01", "08-15", "10-12", "11-01", "12-06", "12-08", "12-25"];

const esFinDeSemana = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;
const esFestivo = (d: Date) => FESTIVOS_FIJOS.includes(d.toISOString().slice(5, 10));

/**
 * Suma N días HÁBILES a una fecha. Es lo que dice un requerimiento: "diez días
 * hábiles desde la notificación", y de ahí sale el día en que se convierte en
 * sanción.
 */
export function sumarDiasHabiles(desde: string, dias: number): string | null {
  const d = new Date(`${desde}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  let quedan = dias;
  // Tope de seguridad: 400 vueltas es más de un año de calendario.
  let vueltas = 0;
  while (quedan > 0 && vueltas < 400) {
    d.setUTCDate(d.getUTCDate() + 1);
    vueltas++;
    if (!esFinDeSemana(d) && !esFestivo(d)) quedan--;
  }
  return quedan === 0 ? d.toISOString().slice(0, 10) : null;
}

// -----------------------------------------------------------------------------
// Las obligaciones que SÍ se guardan
// -----------------------------------------------------------------------------
//
// Las trimestrales no se guardan: se calculan de lo que cada cliente tiene
// marcado, y así marcar un modelo nuevo llena la agenda al instante y desmarcarlo
// la limpia. Se guardan las que nadie más conoce: lo que llega por correo, los
// calendarios de aplazamiento y los vencimientos de contratos.

export type TipoObligacion =
  | "requerimiento"   // plazo corto; si caduca, sanción. Lo más grave.
  | "aplazamiento"    // un vencimiento del calendario de pago con Hacienda
  | "contrato"        // fin de contrato, prórroga
  | "seg_social"      // alta, baja, vencimiento
  | "otra";

export const ETIQUETA_TIPO: Record<TipoObligacion, string> = {
  requerimiento: "REQUERIMIENTO",
  aplazamiento: "APLAZAMIENTO",
  contrato: "CONTRATO",
  seg_social: "SEG. SOCIAL",
  otra: "OTRA",
};

export type Obligacion = {
  id: string;
  tenantId: string;
  tipo: TipoObligacion;
  titulo: string;
  detalle?: string;
  clienteId: string | null;
  clienteNombre: string | null;
  /** "AAAA-MM-DD". Sin fecha = hay que mirarlo: se enseña arriba y marcado. */
  vence: string | null;
  /**
   * De dónde salió. Igual que con las facturas: una obligación que aparece sola
   * sin decir de dónde viene no se cree, y con razón.
   */
  motivo?: string;
  /** El correo del que salió, para poder abrirlo sin buscarlo. */
  correoId?: string;
  /** Saltarse esto tumba algo entero (un aplazamiento) o genera sanción. */
  critico?: boolean;
  creadoEn: string;
};

const CLAVE = (t: string) => `gestoria:obligaciones:${t}`;
const FICHERO = path.join(process.cwd(), "data", "gestoria-obligaciones.json");

export async function listarObligaciones(tenantId: string): Promise<Obligacion[]> {
  if (supabaseEnabled()) return (await kvGet<Obligacion[]>(CLAVE(tenantId))) ?? [];
  try {
    const todo = JSON.parse(await fs.readFile(FICHERO, "utf-8")) as Record<string, Obligacion[]>;
    return todo[tenantId] ?? [];
  } catch {
    return [];
  }
}

async function guardarTodas(tenantId: string, lista: Obligacion[]): Promise<void> {
  if (supabaseEnabled()) { await kvSet(CLAVE(tenantId), lista); return; }
  await fs.mkdir(path.dirname(FICHERO), { recursive: true });
  let todo: Record<string, Obligacion[]> = {};
  try { todo = JSON.parse(await fs.readFile(FICHERO, "utf-8")); } catch { /* primera vez */ }
  todo[tenantId] = lista;
  await fs.writeFile(FICHERO, JSON.stringify(todo, null, 2));
}

/**
 * Reemplaza la lista entera de un tenant. Solo la usa la siembra de la gestoría
 * de demostración: el resto del módulo añade y quita de una en una, que es como
 * se trabaja de verdad. Se exporta para no tener que duplicar `guardarTodas`
 * fuera —una segunda forma de escribir en el mismo sitio es una segunda forma
 * de que se queden distintas—.
 */
export async function reemplazarObligaciones(tenantId: string, lista: Obligacion[]): Promise<void> {
  await guardarTodas(tenantId, lista);
}

export async function apuntarObligacion(o: Omit<Obligacion, "id" | "creadoEn">): Promise<Obligacion> {
  const nueva: Obligacion = {
    ...o,
    id: `obl:${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    creadoEn: new Date().toISOString(),
  };
  const todas = await listarObligaciones(o.tenantId);
  await guardarTodas(o.tenantId, [...todas, nueva]);
  return nueva;
}

/** Cambiar de cliente una obligación que entró sin dueño. */
export async function asignarObligacion(
  tenantId: string,
  id: string,
  clienteId: string,
  clienteNombre: string,
): Promise<void> {
  const todas = await listarObligaciones(tenantId);
  await guardarTodas(
    tenantId,
    todas.map((o) => (o.id === id ? { ...o, clienteId, clienteNombre } : o)),
  );
}

export async function borrarObligacion(tenantId: string, id: string): Promise<void> {
  const todas = await listarObligaciones(tenantId);
  await guardarTodas(tenantId, todas.filter((o) => o.id !== id));
}

/**
 * ¿Ya está apuntado este requerimiento?
 *
 * Abrir dos veces el mismo correo no puede crear dos obligaciones. Se compara
 * por el correo del que salió, que es lo único estable.
 */
export async function existeDeCorreo(tenantId: string, correoId: string): Promise<boolean> {
  if (!correoId) return false;
  return (await listarObligaciones(tenantId)).some((o) => o.correoId === correoId);
}

// -----------------------------------------------------------------------------
// La agenda: todo junto, ordenado por fecha límite
// -----------------------------------------------------------------------------

/** Cuánto aprieta. Es lo que decide el color de la línea. */
export type Apremio = "vencido" | "rojo" | "ambar" | "normal" | "sin_fecha";

/**
 * Rojo a 3 días, ámbar a 7.
 *
 * Distinto de HOY, que pone rojo solo a 1 día, y es a propósito: HOY contesta
 * "¿qué hago ahora?" y ahí el rojo tiene que costar o deja de mirarse. La agenda
 * contesta "¿qué se me viene encima?", y a tres días de un modelo trimestral
 * todavía se puede pedir la documentación que falta. A un día, ya no.
 */
export function apremioDe(vence: string | null | undefined): Apremio {
  const d = diasHasta(vence);
  if (d === null) return "sin_fecha";
  if (d < 0) return "vencido";
  if (d <= 3) return "rojo";
  if (d <= 7) return "ambar";
  return "normal";
}

export type LineaAgenda = Tarea & {
  tipo: TipoObligacion | "modelo" | "facturas" | "expediente" | "otra";
  etiqueta: string;
  apremio: Apremio;
  dias: number | null;
  critico?: boolean;
  motivo?: string;
  correoId?: string;
  /** Sin cliente y hay que decir de quién es. */
  sinCliente?: boolean;
};

/**
 * Todo lo que la agenda tiene que enseñar, ordenado por fecha límite.
 *
 * `hechos` viene del mismo almacén que HOY, así que marcar hecho en una vista lo
 * marca en la otra. Es la razón de que esto no sea un sistema aparte.
 */
export async function construirAgenda(
  tenantId: string,
  opts: { incluirHechas?: boolean } = {},
): Promise<LineaAgenda[]> {
  const [clientes, identidades, obligaciones, facturas] = await Promise.all([
    listarClientes(tenantId).catch(() => []),
    listarIdentidades(tenantId).catch(() => []),
    listarObligaciones(tenantId).catch(() => []),
    listarFacturas(tenantId).catch(() => []),
  ]);
  const hechos = await hechosDe(tenantId);
  const nombreDe = (id: string | null) => clientes.find((c) => c.id === id)?.nombre ?? null;

  const lineas: LineaAgenda[] = [];
  const meter = (l: Omit<LineaAgenda, "apremio" | "dias" | "hecho" | "hechoEn">) => {
    const hechoEn = hechos[l.id];
    if (hechoEn && !opts.incluirHechas) return;
    lineas.push({
      ...l,
      apremio: apremioDe(l.vence),
      dias: diasHasta(l.vence),
      hecho: !!hechoEn,
      hechoEn,
    });
  };

  // --- 1. Modelos trimestrales, de lo que cada cliente tiene marcado ---
  const porCliente = new Map(identidades.map((i) => [i.clienteId, i]));
  for (const v of vencimientosVigentes()) {
    for (const c of clientes) {
      const modelos = (porCliente.get(c.id)?.modelos ?? []).filter(esModelo);
      for (const m of modelos) {
        const def = MODELOS_TRIMESTRALES.find((x) => x.id === m)!;
        meter({
          // El id lleva cliente, modelo y periodo: así marcar hecho el 303 del 1T
          // de un cliente no marca el de los otros noventa y nueve.
          id: `mod:${c.id}:${m}:${v.periodo.replace(/\s/g, "")}`,
          titulo: `${def.nombre} · ${v.periodo}`,
          detalle: def.queEs,
          clienteId: c.id,
          clienteNombre: c.nombre,
          vence: v.vence,
          origen: "expediente",
          creadoEn: v.vence,
          tipo: "modelo",
          etiqueta: `MODELO ${m}`,
        });
      }
    }
  }

  // --- 2. Lo apuntado: requerimientos, aplazamientos, contratos ---
  for (const o of obligaciones) {
    meter({
      id: o.id,
      titulo: o.titulo,
      detalle: o.detalle,
      clienteId: o.clienteId,
      clienteNombre: o.clienteNombre ?? nombreDe(o.clienteId),
      vence: o.vence,
      origen: o.correoId ? "correo" : "manual",
      creadoEn: o.creadoEn,
      tipo: o.tipo,
      etiqueta: ETIQUETA_TIPO[o.tipo],
      critico: o.critico,
      motivo: o.motivo,
      correoId: o.correoId,
      sinCliente: !o.clienteId,
    });
  }

  // --- 3. Facturas que faltan para poder cerrar el trimestre ---
  //
  // Se cuentan las que están sin identificar: mientras no tengan dueño no entran
  // en el cuadre de nadie, así que literalmente impiden cerrar. Se agrupa en UNA
  // línea: cien líneas de "falta una factura" ahogarían las cuatro que tienen
  // fecha legal, que es justo lo que la agenda viene a evitar.
  const sinDueno = facturas.filter((f) => !f.cliente_id && f.estado !== "descartada" && !f.duplicado_de);
  if (sinDueno.length) {
    const proximo = vencimientosVigentes()[0];
    meter({
      id: `fac:sin-identificar`,
      titulo: `${sinDueno.length} documento${sinDueno.length === 1 ? "" : "s"} sin identificar`,
      detalle: "Mientras no se sepa de quién son no entran en ningún cuadre y no se puede cerrar el trimestre.",
      clienteId: null,
      clienteNombre: null,
      vence: proximo?.vence ?? null,
      origen: "factura_sin_asignar",
      creadoEn: new Date().toISOString(),
      tipo: "facturas",
      etiqueta: "FACTURAS",
    });
  }

  return ordenarAgenda(lineas);
}

/**
 * El orden: POR FECHA LÍMITE. Punto.
 *
 * Lo crítico NO sube. Se probó y quedaba mal de verdad: un requerimiento a
 * quince días aparecía por encima de una deuda que vencía en cuatro, y una lista
 * que dice "ordenada por fecha límite" y no lo está deja de poder leerse de un
 * vistazo — que es lo único que tiene que saber hacer. Lo crítico se marca con
 * su cartel y con su color; para eso está el cartel.
 *
 * Lo SIN FECHA va arriba, no abajo: casi siempre es un requerimiento cuyo plazo
 * no se ha podido leer, y eso hay que mirarlo hoy, no enterrarlo debajo de los
 * modelos de octubre.
 */
export function ordenarAgenda(lineas: LineaAgenda[]): LineaAgenda[] {
  return [...lineas].sort((a, b) => {
    if (!!a.hecho !== !!b.hecho) return a.hecho ? 1 : -1;
    if (!a.vence && !b.vence) return a.creadoEn.localeCompare(b.creadoEn);
    if (!a.vence) return -1;
    if (!b.vence) return 1;
    return a.vence.localeCompare(b.vence) || a.titulo.localeCompare(b.titulo, "es");
  });
}

// -----------------------------------------------------------------------------
// Agrupar: lo que hace la lista legible con cien clientes
// -----------------------------------------------------------------------------
//
// EL PROBLEMA ES DE ESCALA, no de diseño. Con seis clientes de prueba la lista
// se lee. Jose tiene cien, y casi todos presentan el 303: la semana del 20 de
// octubre le salen doscientas o trescientas líneas que dicen exactamente lo
// mismo cambiando el nombre. Eso no es una agenda, es un listado, y un listado
// de trescientas líneas no se mira.
//
// Y lo importante es que "Modelo 303 · 87 clientes · vence el lunes 20 de
// octubre" NO es menos información: es la misma, dicha una vez. Los ochenta y
// siete siguen ahí, a un clic, para cuando haga falta mirar uno.
//
// QUÉ SE AGRUPA Y QUÉ NO: solo lo que se repite de verdad —mismo tipo, misma
// fecha, y al menos dos—. Un requerimiento es único por definición y se queda en
// su línea; agruparlo con otro solo porque los dos son requerimientos escondería
// dos cosas distintas debajo del mismo rótulo.

export type GrupoAgenda = {
  /** Estable: sirve de key y para recordar cuál está abierto. */
  id: string;
  /** "Modelo 303 · 3T 2026". Lo que se repite. */
  titulo: string;
  etiqueta: string;
  vence: string | null;
  dias: number | null;
  apremio: Apremio;
  critico: boolean;
  /** Las líneas de dentro, una por cliente. */
  lineas: LineaAgenda[];
};

/** Una fila de la pantalla: o una línea suelta, o un grupo desplegable. */
export type FilaAgenda =
  | { tipo: "linea"; linea: LineaAgenda }
  | { tipo: "grupo"; grupo: GrupoAgenda };

/** A partir de cuántos se agrupa. Dos ya merece la pena; con uno no hay grupo. */
const MINIMO_PARA_AGRUPAR = 2;

/**
 * Convierte la lista plana en filas, agrupando lo repetido.
 *
 * El orden general NO cambia: sigue mandando la fecha límite. Un grupo se coloca
 * donde estaría su primera línea, que es la misma fecha para todas.
 */
export function agruparAgenda(lineas: LineaAgenda[]): FilaAgenda[] {
  // La clave del grupo es el TÍTULO + la FECHA. El título de un modelo ya trae
  // el periodo ("Modelo 303 · 3T 2026"), así que dos trimestres distintos no se
  // mezclan aunque coincidiera la fecha.
  const clave = (l: LineaAgenda) => `${l.tipo}|${l.titulo}|${l.vence ?? "sin"}`;

  const orden: string[] = [];
  const porClave = new Map<string, LineaAgenda[]>();
  for (const l of lineas) {
    const k = clave(l);
    if (!porClave.has(k)) { porClave.set(k, []); orden.push(k); }
    porClave.get(k)!.push(l);
  }

  const filas: FilaAgenda[] = [];
  for (const k of orden) {
    const xs = porClave.get(k)!;
    // Sin cliente no se agrupa: "3 documentos sin identificar" ya es un resumen
    // de por sí, y meterlo en un grupo sería resumir un resumen.
    if (xs.length < MINIMO_PARA_AGRUPAR || !xs[0].clienteId) {
      for (const l of xs) filas.push({ tipo: "linea", linea: l });
      continue;
    }
    const p = xs[0];
    filas.push({
      tipo: "grupo",
      grupo: {
        id: `g:${k}`,
        titulo: p.titulo,
        etiqueta: p.etiqueta,
        vence: p.vence ?? null,
        dias: p.dias,
        apremio: p.apremio,
        // El grupo es crítico si lo es CUALQUIERA de los suyos: esconder un
        // crítico dentro de un grupo tranquilo sería justo lo contrario de lo
        // que se busca.
        critico: xs.some((x) => !!x.critico),
        lineas: xs,
      },
    });
  }
  return filas;
}
