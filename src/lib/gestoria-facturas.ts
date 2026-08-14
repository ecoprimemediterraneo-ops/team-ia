// =============================================================================
// GESTORÍA — el saco de facturas del cliente y el extracto del banco.
// =============================================================================
//
// El problema real: las facturas de un cliente llegan por TRES sitios (una foto
// por WhatsApp, un PDF adjunto en un correo, o el gestor subiéndolas a mano) y
// acaban repartidas por tres sitios distintos. Aquí caen todas al MISMO saco,
// por cliente, venga de donde venga.
//
// Después se cruza ese saco contra el extracto bancario y lo que importa no es
// lo que casa: es **el cargo que no tiene factura que lo justifique**. Eso es lo
// que se reclama.
//
// LO QUE ESTE MÓDULO NO HACE, Y NO ES UN OLVIDO:
//   · NO lee el importe de la imagen. Nada de OCR. El importe lo teclea el
//     gestor o viene en el propio mensaje. Un OCR que se equivoca en un dígito
//     concilia un cargo que no era y eso es peor que no conciliar nada.
//   · NO interpreta nada fiscal ni contable. El sistema dice "hay un cargo sin
//     factura" y se calla. Nunca si algo es deducible, ni plazos, ni
//     obligaciones: eso lo dice el gestor.
//   · NO casa pagos parciales ni aplazados. Los pagarés quedan fuera.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, getSupabase, supabaseEnabled } from "./supabase";

// -----------------------------------------------------------------------------
// Modelo
// -----------------------------------------------------------------------------

export type OrigenFactura = "whatsapp" | "email" | "manual";
export type TipoFichero = "imagen" | "pdf";
/**
 * "sin_asignar" es el estado de una factura que ha ENTRADO pero de la que no se
 * sabe de quién es: un correo de un remitente desconocido, un WhatsApp de un
 * número que no está en ninguna ficha. Antes se descartaba y se perdía, que es
 * lo peor que puede pasar con el documento de un tercero. Ahora se guarda y
 * espera a que el gestor la coloque de un clic.
 */
export type EstadoFactura = "sin_asignar" | "pendiente" | "conciliada" | "descartada";

export type FacturaRecibida = {
  id: string;
  tenant_id: string;
  /** null = todavía no se sabe de quién es. Ver `EstadoFactura.sin_asignar`. */
  cliente_id: string | null;
  origen: OrigenFactura;
  fecha_recepcion: string;      // ISO
  fichero_url: string;          // ruta en Storage (privada) o ruta local en dev
  tipo: TipoFichero;
  nombre_original: string;
  importe: number | null;       // lo teclea el gestor; null = fuera del cruce
  fecha_factura: string | null; // "YYYY-MM-DD"
  proveedor: string | null;
  estado: EstadoFactura;
  movimiento_id: string | null;
  notas: string;
  /**
   * De quién llegó: el email o el teléfono. Con el asunto y la fecha es lo que
   * permite al gestor reconocer una factura sin asignar sin abrir el fichero.
   */
  remitente?: string;
  asunto?: string;
  /**
   * Justificante de un cargo que no lleva factura de proveedor: el modelo
   * presentado, el TC de la Seguridad Social, la nómina. Lo aporta el gestor.
   *
   * NO es una factura: no entra en el cruce, no cuenta como justificación
   * contable y no sale en lo que se exporta a Bilky. Es un papel guardado
   * donde toca para cuando alguien pregunte.
   */
  es_justificante?: boolean;
  /** Cargos que cubre. Un TC cubre todas las cuotas del mes. */
  cubre_movimientos?: string[];
};

export type SignoMovimiento = "cargo" | "abono";
/**
 * "sugerido" es un cargo que CASA con algo pero no se ha dado por bueno solo.
 * Existe como estado propio porque no es ninguna de las otras dos cosas: ni está
 * justificado ni se le puede reclamar al cliente. Está esperando un clic.
 */
export type EstadoMovimiento = "sin_factura" | "sugerido" | "conciliado" | "ignorado";

/** Por qué el gestor quitó la marca a un cargo al ir a reclamarlo. */
export type MotivoNoReclamar =
  | "la_tengo"        // la tiene él y la sube: deja de faltar
  | "no_corresponde"  // no es un gasto que deba justificar ese cliente
  | "ahora_no";       // decisión suya; se le vuelve a ofrecer

export type MovimientoBanco = {
  id: string;
  tenant_id: string;
  cliente_id: string;
  fecha: string;                // "YYYY-MM-DD"
  signo: SignoMovimiento;
  importe: number;              // siempre positivo; el signo va aparte
  concepto: string;
  referencia: string;
  estado: EstadoMovimiento;
  factura_id: string | null;
  lote_id: string;
  fecha_importacion: string;    // ISO

  // --- Seguimiento entre pasadas ---
  // Un cargo se cruza muchas veces, no una. Lo que interesa no es la foto de
  // hoy, es que el número baje: estos campos son los que cuentan esa historia.

  /** En cuántas pasadas ha salido sin justificar. */
  veces_sin_justificar?: number;
  /** Si acabó justificándose, tras cuántas pasadas esperando. */
  resuelto_tras?: number;
  /** A quién se le pidió la factura y cuándo. */
  pedido_a?: string;
  pedido_canal?: "whatsapp" | "email";
  pedido_en?: string;           // ISO
  /** Por qué el gestor lo dejó fuera de la reclamación. */
  motivo?: MotivoNoReclamar;
  motivo_en?: string;           // ISO
  /**
   * Facturas que el gestor ya dijo que NO son de este cargo. Sin esto, la
   * siguiente pasada volvería a proponer exactamente lo mismo, para siempre.
   */
  sugerencias_rechazadas?: string[];

  // --- En qué bloque se enseña ---
  //
  // Lo normal lo decide el clasificador por el concepto. Esto es lo que el
  // gestor ha dicho A MANO, que manda siempre sobre la lista.
  /** "no_lleva" lo baja al bloque 3; "lleva" lo sube al 2. */
  bloque_manual?: "lleva" | "no_lleva";
  /** Justificante que aporta el gestor (un modelo, un TC, una nómina). */
  justificante_id?: string;
};

/**
 * Un concepto que el gestor movió a mano, para ese cliente.
 *
 * Mover el mismo cargo cada mes es trabajo que el sistema le está pasando a él.
 * La primera vez que dice "esto no lleva factura", se aprende el concepto y la
 * próxima ya va colocado.
 */
export type ConceptoAprendido = {
  cliente_id: string;
  /** Concepto normalizado: mayúsculas, sin tildes ni signos. */
  concepto: string;
  destino: "lleva" | "no_lleva";
  aprendido_en: string;
};

/**
 * Una pasada de conciliación: la foto de un día.
 *
 * Se guardan todas para poder enseñar "24 feb: 5 sin justificar · 26 feb: 2 ·
 * 2 mar: 1". Ese descenso es el trabajo hecho, y lo que queda al final del mes
 * son las facturas que de verdad no existen.
 */
export type PasadaConciliacion = {
  id: string;
  tenant_id: string;
  cliente_id: string;
  fecha: string;                // ISO
  sinJustificar: number;
  importeSinJustificar: number;
  conciliados: number;
  sugerencias: number;
  /** Recuento de los motivos vivos al cerrar la pasada. */
  motivos: { la_tengo: number; no_corresponde: number; ahora_no: number };
};

// -----------------------------------------------------------------------------
// Almacén — aislado por tenant SIEMPRE
// -----------------------------------------------------------------------------
//
// Una clave por tenant y el cliente se filtra dentro. Mismo patrón que el resto
// del sistema (expedientes, reglas de Marta): Supabase kv en producción, JSON
// local cuando no hay credenciales.

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_FACTURAS = path.join(DATA_DIR, "gestoria-facturas.json");
const FILE_MOVIMIENTOS = path.join(DATA_DIR, "gestoria-movimientos.json");

const FILE_PASADAS = path.join(DATA_DIR, "gestoria-pasadas.json");
const FILE_CONCEPTOS = path.join(DATA_DIR, "gestoria-conceptos.json");

const KEY_FACTURAS = (t: string) => `gestoria:facturas:${t}`;
const KEY_MOVIMIENTOS = (t: string) => `gestoria:movimientos:${t}`;
const KEY_PASADAS = (t: string) => `gestoria:pasadas:${t}`;
const KEY_CONCEPTOS = (t: string) => `gestoria:conceptos:${t}`;

async function leerLocal<T>(fichero: string, tenantId: string): Promise<T[]> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(fichero, "utf-8").catch(() => "{}");
    const all = raw.trim() ? (JSON.parse(raw) as Record<string, T[]>) : {};
    return all[tenantId] ?? [];
  } catch {
    return [];
  }
}

async function escribirLocal<T>(fichero: string, tenantId: string, lista: T[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const raw = await fs.readFile(fichero, "utf-8").catch(() => "{}");
  const all = raw.trim() ? (JSON.parse(raw) as Record<string, T[]>) : {};
  all[tenantId] = lista;
  await fs.writeFile(fichero, JSON.stringify(all, null, 2));
}

export async function listarFacturas(tenantId: string, clienteId?: string): Promise<FacturaRecibida[]> {
  const todas = supabaseEnabled()
    ? (await kvGet<FacturaRecibida[]>(KEY_FACTURAS(tenantId))) ?? []
    : await leerLocal<FacturaRecibida>(FILE_FACTURAS, tenantId);
  // Pedir las de un cliente NUNCA devuelve las que no tienen dueño: si se
  // colaran, entrarían en su cruce y le conciliarían un cargo con la factura de
  // otro. Para esas está `listarSinAsignar`.
  const suyas = clienteId ? todas.filter((f) => f.cliente_id === clienteId) : todas;
  return suyas.sort((a, b) => b.fecha_recepcion.localeCompare(a.fecha_recepcion));
}

/** Las que entraron sin dueño y siguen esperando a que alguien las coloque. */
export async function listarSinAsignar(tenantId: string): Promise<FacturaRecibida[]> {
  const todas = await listarFacturas(tenantId);
  return todas.filter((f) => !f.cliente_id && f.estado === "sin_asignar");
}

export async function guardarFacturas(tenantId: string, lista: FacturaRecibida[]): Promise<void> {
  if (supabaseEnabled()) return kvSet(KEY_FACTURAS(tenantId), lista);
  return escribirLocal(FILE_FACTURAS, tenantId, lista);
}

export async function listarMovimientos(tenantId: string, clienteId?: string): Promise<MovimientoBanco[]> {
  const todos = supabaseEnabled()
    ? (await kvGet<MovimientoBanco[]>(KEY_MOVIMIENTOS(tenantId))) ?? []
    : await leerLocal<MovimientoBanco>(FILE_MOVIMIENTOS, tenantId);
  const suyos = clienteId ? todos.filter((m) => m.cliente_id === clienteId) : todos;
  return suyos.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/**
 * Qué extracto tiene ya subido un cliente. Solo lee: sirve para avisar en
 * pantalla antes de volver a subir uno, y para saber si la conciliación tiene
 * algo contra lo que cuadrar.
 */
export async function extractoDeCliente(
  tenantId: string,
  clienteId: string,
): Promise<{ total: number; desde: string; hasta: string; ultimaImportacion: string; lotes: number } | null> {
  const movs = await listarMovimientos(tenantId, clienteId);
  if (!movs.length) return null;
  const fechas = movs.map((m) => m.fecha).sort();
  const importaciones = movs.map((m) => m.fecha_importacion).sort();
  return {
    total: movs.length,
    desde: fechas[0],
    hasta: fechas[fechas.length - 1],
    ultimaImportacion: importaciones[importaciones.length - 1],
    lotes: new Set(movs.map((m) => m.lote_id)).size,
  };
}

export async function guardarMovimientos(tenantId: string, lista: MovimientoBanco[]): Promise<void> {
  if (supabaseEnabled()) return kvSet(KEY_MOVIMIENTOS(tenantId), lista);
  return escribirLocal(FILE_MOVIMIENTOS, tenantId, lista);
}

const nuevoId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// -----------------------------------------------------------------------------
// Ficheros — bucket PRIVADO y URL firmada con caducidad
// -----------------------------------------------------------------------------

export const BUCKET = "facturas";
/** Caducidad de la URL firmada. Corta a propósito: es una factura de un tercero. */
export const FIRMA_SEGUNDOS = 60 * 10;

/**
 * `tenant/cliente/AAAA-MM/fichero`, que es la ruta pactada.
 *
 * Sin cliente conocido va a `_sin-asignar`. La carpeta se queda como estaba
 * cuando se asigna después: mover el binario para reflejar un cambio de estado
 * es pedir que un día se pierda el fichero a mitad de la operación. Lo que manda
 * es `cliente_id` en el registro, no dónde está el archivo.
 */
export function rutaStorage(tenantId: string, clienteId: string | null, nombre: string, cuando = new Date()): string {
  const mes = `${cuando.getUTCFullYear()}-${String(cuando.getUTCMonth() + 1).padStart(2, "0")}`;
  const limpio = nombre.replace(/[^\w.\-]+/g, "_").slice(-80);
  return `${tenantId}/${clienteId || "_sin-asignar"}/${mes}/${Date.now().toString(36)}_${limpio}`;
}

/** Tipo admitido. Lo demás (audio, vídeo, sticker) no es una factura. */
export function tipoDeFichero(mime: string, nombre = ""): TipoFichero | null {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/")) return "imagen";
  if (m === "application/pdf") return "pdf";
  if (/\.pdf$/i.test(nombre)) return "pdf";
  if (/\.(jpe?g|png|heic|webp)$/i.test(nombre)) return "imagen";
  return null;
}

/**
 * Sube el fichero y devuelve su ruta.
 *
 * En local, sin credenciales de Supabase, se guarda en `data/facturas-files/`
 * para poder probar el módulo entero de punta a punta. Esa carpeta está en el
 * `data/` de siempre, que ya está fuera de git.
 */
export async function subirFichero(opts: {
  tenantId: string;
  clienteId: string | null;
  nombre: string;
  contenido: Buffer;
  mime: string;
}): Promise<string> {
  const ruta = rutaStorage(opts.tenantId, opts.clienteId, opts.nombre);

  if (supabaseEnabled()) {
    const sb = getSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.storage.from(BUCKET) as any).upload(ruta, opts.contenido, {
      contentType: opts.mime || "application/octet-stream",
      upsert: false,
    });
    if (error) throw new Error(`No se pudo subir el fichero: ${error.message}`);
    return ruta;
  }

  const destino = path.join(DATA_DIR, "facturas-files", ruta);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, opts.contenido);
  return ruta;
}

/**
 * URL firmada y CADUCA para ver un fichero. Nunca se expone la ruta cruda ni se
 * hace público el bucket: son documentos contables de un tercero.
 *
 * En local devuelve la ruta del endpoint autenticado que sirve el fichero.
 */
export async function urlFirmada(ruta: string): Promise<string | null> {
  if (!supabaseEnabled()) return `/api/gestoria/facturas/fichero?ruta=${encodeURIComponent(ruta)}`;
  const sb = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.storage.from(BUCKET) as any).createSignedUrl(ruta, FIRMA_SEGUNDOS);
  if (error) return null;
  return (data?.signedUrl as string) ?? null;
}

/** Lee el fichero de vuelta. Lo usa el endpoint local que los sirve. */
export async function leerFicheroLocal(ruta: string): Promise<Buffer | null> {
  // Cortafuegos de recorrido de directorio: la ruta siempre es relativa al
  // almacén y nunca puede salirse de él.
  const base = path.join(DATA_DIR, "facturas-files");
  const destino = path.resolve(base, ruta);
  if (!destino.startsWith(path.resolve(base))) return null;
  return fs.readFile(destino).catch(() => null);
}

// -----------------------------------------------------------------------------
// Alta de una factura — el único camino, vengan de donde vengan
// -----------------------------------------------------------------------------

export async function crearFactura(opts: {
  tenantId: string;
  /** null cuando no se sabe de quién es: entra igual, como sin_asignar. */
  clienteId: string | null;
  origen: OrigenFactura;
  nombre: string;
  contenido: Buffer;
  mime: string;
  importe?: number | null;
  fechaFactura?: string | null;
  proveedor?: string | null;
  notas?: string;
  remitente?: string;
  asunto?: string;
}): Promise<FacturaRecibida> {
  const tipo = tipoDeFichero(opts.mime, opts.nombre);
  if (!tipo) throw new Error("Tipo de fichero no admitido: solo imagen o PDF");

  const ruta = await subirFichero({
    tenantId: opts.tenantId,
    clienteId: opts.clienteId,
    nombre: opts.nombre,
    contenido: opts.contenido,
    mime: opts.mime,
  });

  const factura: FacturaRecibida = {
    id: nuevoId("fac"),
    tenant_id: opts.tenantId,
    cliente_id: opts.clienteId,
    origen: opts.origen,
    fecha_recepcion: new Date().toISOString(),
    fichero_url: ruta,
    tipo,
    nombre_original: opts.nombre,
    importe: opts.importe ?? null,
    fecha_factura: opts.fechaFactura ?? null,
    proveedor: opts.proveedor ?? null,
    // Sin dueño no puede estar "pendiente": pendiente significa que espera a
    // cruzarse con el banco, y sin cliente no hay banco contra el que cruzar.
    estado: opts.clienteId ? "pendiente" : "sin_asignar",
    movimiento_id: null,
    notas: opts.notas ?? "",
    remitente: opts.remitente,
    asunto: opts.asunto,
  };

  const todas = await listarFacturas(opts.tenantId);
  await guardarFacturas(opts.tenantId, [...todas, factura]);
  return factura;
}

/**
 * Coloca una factura sin asignar en su cliente. Pasa a "pendiente" y desde ese
 * momento entra en el cruce con el banco como cualquier otra.
 */
export async function asignarCliente(
  tenantId: string,
  id: string,
  clienteId: string,
): Promise<FacturaRecibida | null> {
  if (!clienteId) return null;
  const todas = await listarFacturas(tenantId);
  const i = todas.findIndex((f) => f.id === id);
  if (i < 0) return null;
  const actualizada: FacturaRecibida = {
    ...todas[i],
    cliente_id: clienteId,
    estado: "pendiente",
  };
  todas[i] = actualizada;
  await guardarFacturas(tenantId, todas);
  return actualizada;
}

export async function actualizarFactura(
  tenantId: string,
  id: string,
  cambios: Partial<Pick<FacturaRecibida, "importe" | "fecha_factura" | "proveedor" | "estado" | "notas">>,
): Promise<FacturaRecibida | null> {
  const todas = await listarFacturas(tenantId);
  const i = todas.findIndex((f) => f.id === id);
  if (i < 0) return null;
  const actualizada = { ...todas[i], ...cambios };
  todas[i] = actualizada;
  await guardarFacturas(tenantId, todas);
  return actualizada;
}

// -----------------------------------------------------------------------------
// Histórico de pasadas
// -----------------------------------------------------------------------------

export async function listarPasadas(tenantId: string, clienteId?: string): Promise<PasadaConciliacion[]> {
  const todas = supabaseEnabled()
    ? (await kvGet<PasadaConciliacion[]>(KEY_PASADAS(tenantId))) ?? []
    : await leerLocal<PasadaConciliacion>(FILE_PASADAS, tenantId);
  const suyas = clienteId ? todas.filter((p) => p.cliente_id === clienteId) : todas;
  return suyas.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function anotarPasada(
  tenantId: string,
  pasada: Omit<PasadaConciliacion, "id" | "tenant_id">,
): Promise<PasadaConciliacion> {
  const todas = supabaseEnabled()
    ? (await kvGet<PasadaConciliacion[]>(KEY_PASADAS(tenantId))) ?? []
    : await leerLocal<PasadaConciliacion>(FILE_PASADAS, tenantId);
  const nueva: PasadaConciliacion = {
    ...pasada,
    id: `pas_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    tenant_id: tenantId,
  };
  const lista = [...todas, nueva];
  if (supabaseEnabled()) await kvSet(KEY_PASADAS(tenantId), lista);
  else await escribirLocal(FILE_PASADAS, tenantId, lista);
  return nueva;
}

// -----------------------------------------------------------------------------
// Conceptos aprendidos
// -----------------------------------------------------------------------------

export async function listarConceptos(tenantId: string, clienteId?: string): Promise<ConceptoAprendido[]> {
  const todos = supabaseEnabled()
    ? (await kvGet<ConceptoAprendido[]>(KEY_CONCEPTOS(tenantId))) ?? []
    : await leerLocal<ConceptoAprendido>(FILE_CONCEPTOS, tenantId);
  return clienteId ? todos.filter((c) => c.cliente_id === clienteId) : todos;
}

/** Se aprende POR CLIENTE: el mismo concepto puede significar cosas distintas. */
export async function aprenderConcepto(
  tenantId: string,
  clienteId: string,
  concepto: string,
  destino: "lleva" | "no_lleva",
): Promise<void> {
  if (!concepto.trim()) return;
  const todos = await listarConceptos(tenantId);
  const sinEse = todos.filter((c) => !(c.cliente_id === clienteId && c.concepto === concepto));
  const lista = [...sinEse, { cliente_id: clienteId, concepto, destino, aprendido_en: new Date().toISOString() }];
  if (supabaseEnabled()) await kvSet(KEY_CONCEPTOS(tenantId), lista);
  else await escribirLocal(FILE_CONCEPTOS, tenantId, lista);
}
