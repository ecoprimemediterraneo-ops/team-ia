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

import type { Lectura, ClaseDocumento } from "./gestoria-lectura";

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
   * Qué es este documento y qué pone, según la lectura con IA. Ausente = todavía
   * no se ha leído (o falló la lectura, ver `lectura_error`).
   */
  lectura?: Lectura;
  lectura_error?: string;
  /**
   * En qué punto va la lectura con IA.
   *
   * Hace falta un estado propio porque "no hay lectura" ya no significa una
   * sola cosa: puede ser que acabe de entrar y se esté leyendo AHORA MISMO, o
   * que la lectura fallara. Sin distinguirlo, la pantalla decía "Sin leer
   * todavía" en los dos casos y el gestor no sabía si esperar o reintentar.
   */
  lectura_estado?: "leyendo" | "hecha" | "error";
  /**
   * Cómo llegó a tener dueño. Se guarda para poder enseñarlo y para poder
   * distinguir lo que decidió la máquina de lo que decidió el gestor: si un día
   * la asignación automática se equivoca, hay que poder ver cuáles tocó ella.
   */
  asignado_por?: "nif" | "telefono" | "email" | "manual";
  /** La frase que se le enseña al gestor: "NIF B12345678 coincide con Bar El Puerto". */
  asignado_motivo?: string;
  /**
   * Este documento ya estaba: apunta al que entró primero. Un duplicado NO
   * cuenta en los totales ni cruza con el banco, pero no se borra jamás —
   * borrar una factura buena creyéndola repetida es peor que contarla dos
   * veces: la de verdad desaparece y nadie se entera hasta el cierre.
   */
  duplicado_de?: string;
  duplicado_certeza?: "seguro" | "probable";
  duplicado_detalle?: string;
  /** El gestor ha dicho que NO lo es. No se vuelve a marcar. */
  duplicado_descartado?: boolean;
  /**
   * El mismo NIF o teléfono está en dos fichas, así que NO se ha asignado.
   * Elegir uno a cara o cruz deja un error escrito y silencioso.
   */
  conflicto?: {
    motivo: "nif" | "telefono" | "email";
    valor: string;
    clientes: Array<{ id: string; nombre: string }>;
    detalle: string;
  };
  /** Copia plana de `lectura.clase` para poder filtrar sin abrir la lectura. */
  clase?: ClaseDocumento;
  /**
   * ¿Cuenta como documento contable? Un albarán o un presupuesto NO: cruzarlos
   * con un cargo daría por justificado un pago que no lo está.
   */
  contable?: boolean;
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

/**
 * Los bytes de un documento ya guardado, venga de Supabase o del disco.
 *
 * Existe para poder RELEER: si la lectura falló (o el documento entró antes de
 * que hubiera lectura automática), hay que volver a pasarlo por la IA, y para
 * eso hace falta el fichero, no la URL.
 */
export async function leerFicheroGuardado(ruta: string): Promise<Buffer | null> {
  if (!supabaseEnabled()) return leerFicheroLocal(ruta);
  try {
    const sb = getSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.storage.from(BUCKET) as any).download(ruta);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch {
    return null;
  }
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
 * Lee el documento con IA y guarda lo que dice en el registro.
 *
 * Se llama DESPUÉS de crear la factura, nunca antes, y no lanza: si la lectura
 * falla, el documento ya está guardado y el gestor lo ve igual, con el motivo
 * escrito. El orden importa — leer primero y guardar después significaría
 * perder la factura cada vez que la IA tenga un mal día.
 */
export async function leerYGuardar(opts: {
  tenantId: string;
  facturaId: string;
  contenido: Buffer;
  mime: string;
  nombre?: string;
}): Promise<FacturaRecibida | null> {
  const { leerDocumento, datosDeLectura, ES_CONTABLE } = await import("./gestoria-lectura");
  const r = await leerDocumento({ contenido: opts.contenido, mime: opts.mime, nombre: opts.nombre });

  const todas = await listarFacturas(opts.tenantId);
  const i = todas.findIndex((f) => f.id === opts.facturaId);
  if (i < 0) return null;

  if (!r.ok) {
    todas[i] = { ...todas[i], lectura_error: r.error, lectura_estado: "error" };
    await guardarFacturas(opts.tenantId, todas);
    console.warn(`[gestoria] no se ha podido leer ${opts.facturaId}: ${r.error}`);
    return todas[i];
  }

  const d = datosDeLectura(r.lectura);
  todas[i] = {
    ...todas[i],
    lectura: r.lectura,
    lectura_error: undefined,
    lectura_estado: "hecha",
    clase: r.lectura.clase,
    contable: ES_CONTABLE[r.lectura.clase],
    // Lo leído solo rellena lo que estaba vacío: si el gestor ya escribió un
    // importe a mano, manda el suyo. La IA propone, el gestor dispone.
    importe: todas[i].importe ?? d.importe,
    fecha_factura: todas[i].fecha_factura ?? d.fechaFactura,
    proveedor: todas[i].proveedor ?? d.proveedor,
  };
  await guardarFacturas(opts.tenantId, todas);

  // El gasto se anota SIEMPRE que la lectura devuelva tokens, incluso si el
  // documento se descarta después: la llamada ya está pagada.
  if (r.lectura.tokens) {
    const { anotarLectura } = await import("./gestoria-coste");
    await anotarLectura({
      tenantId: opts.tenantId,
      modelo: r.lectura.modelo,
      entrada: r.lectura.tokens.entrada,
      salida: r.lectura.tokens.salida,
    });
  }

  console.log(`[gestoria] leído ${opts.facturaId}: ${r.lectura.clase} (${r.lectura.confianza}, ${r.lectura.modelo})`);
  return todas[i];
}

/**
 * Deja escrito que este documento SE ESTÁ LEYENDO.
 *
 * Se marca antes de arrancar la lectura para que la lista lo diga desde el
 * primer segundo. Sin esto, entre que entra el documento y termina la IA hay
 * unos segundos en los que la pantalla mentía diciendo "sin leer".
 */
export async function marcarLeyendo(tenantId: string, facturaId: string): Promise<void> {
  const todas = await listarFacturas(tenantId);
  const i = todas.findIndex((f) => f.id === facturaId);
  if (i < 0) return;
  todas[i] = { ...todas[i], lectura_estado: "leyendo", lectura_error: undefined };
  await guardarFacturas(tenantId, todas);
}

/**
 * Vuelve a leer un documento que ya está guardado.
 *
 * Para dos cosas: el botón de reintentar cuando la lectura falló, y ponerse al
 * día con los que entraron antes de que esto se leyera solo. Se baja el fichero
 * del almacén y se pasa por el mismo camino de siempre — no hay una segunda
 * forma de leer, que es como acaban divergiendo dos resultados.
 */
export async function releerDocumento(
  tenantId: string,
  facturaId: string,
): Promise<{ ok: true; factura: FacturaRecibida } | { ok: false; error: string }> {
  const todas = await listarFacturas(tenantId);
  const f = todas.find((x) => x.id === facturaId);
  if (!f) return { ok: false, error: "Ese documento ya no está." };

  const contenido = await leerFicheroGuardado(f.fichero_url);
  if (!contenido) {
    return { ok: false, error: "No se ha podido recuperar el fichero guardado para volver a leerlo." };
  }

  await marcarLeyendo(tenantId, facturaId);
  const leida = await leerYGuardar({
    tenantId, facturaId, contenido, mime: mimeDeTipo(f.tipo, f.nombre_original), nombre: f.nombre_original,
  }).catch((e) => {
    console.error("[gestoria] relectura fallida:", e);
    return null;
  });
  if (!leida) return { ok: false, error: "La lectura ha fallado. Puedes volver a intentarlo." };

  // MISMO camino que la entrada nueva: releer sin volver a intentar la
  // asignación dejaría los documentos viejos en la bandeja para siempre, que es
  // justo lo que el botón "Leer los que faltan" viene a vaciar.
  const colocada = await asignarPorDatoDuro(tenantId, facturaId).catch(() => null);
  const revisada = await marcarSiEsDuplicado(tenantId, facturaId).catch(() => null);
  return { ok: true, factura: revisada ?? colocada ?? leida };
}

/**
 * El mime a partir de lo poco que guardamos. Suficiente para la lectura: solo
 * necesita saber si es PDF o imagen, y el nombre desempata.
 */
function mimeDeTipo(tipo: TipoFichero, nombre: string): string {
  if (tipo === "pdf") return "application/pdf";
  const n = (nombre || "").toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

/**
 * Corrige a mano un dato leído. Lo que toca el gestor queda marcado como seguro:
 * su palabra vale más que la de la IA y no tiene que volver a mirarlo.
 */
export async function corregirLectura(
  tenantId: string,
  id: string,
  campo: "emisor" | "nifEmisor" | "nifDestinatario" | "numero" | "fecha" | "total" | "clase",
  valor: string,
): Promise<FacturaRecibida | null> {
  const { ES_CONTABLE } = await import("./gestoria-lectura");
  const todas = await listarFacturas(tenantId);
  const i = todas.findIndex((f) => f.id === id);
  if (i < 0 || !todas[i].lectura) return null;
  const l = { ...todas[i].lectura! };

  if (campo === "clase") {
    const clases = ["factura_completa", "ticket", "albaran", "abono", "presupuesto", "otro"];
    if (!clases.includes(valor)) return null;
    l.clase = valor as ClaseDocumento;
    l.confianza = "alta";
    l.porQue = "Clasificado a mano por el gestor.";
    todas[i] = { ...todas[i], lectura: l, clase: l.clase, contable: ES_CONTABLE[l.clase] };
  } else if (campo === "total") {
    const n = Number(valor.replace(",", "."));
    if (!Number.isFinite(n)) return null;
    l.total = { valor: n, seguro: true };
    todas[i] = { ...todas[i], lectura: l, importe: l.clase === "abono" ? -Math.abs(n) : n };
  } else if (campo === "fecha") {
    l.fecha = { valor: valor || null, seguro: true };
    todas[i] = { ...todas[i], lectura: l, fecha_factura: valor || null };
  } else {
    l[campo] = { valor: valor || null, seguro: true };
    todas[i] = { ...todas[i], lectura: l, ...(campo === "emisor" ? { proveedor: valor || null } : {}) };
  }

  await guardarFacturas(tenantId, todas);
  return todas[i];
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
    // Lo que decide el gestor se marca como suyo: la asignación automática ya
    // no vuelve a tocarlo. Su palabra vale más que la de la máquina, y si le
    // sobrescribiéramos la corrección tendría que hacerla otra vez cada vez que
    // se reprocesa el documento.
    asignado_por: "manual",
    asignado_motivo: undefined,
    conflicto: undefined,
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

// -----------------------------------------------------------------------------
// Asignación automática por dato duro
// -----------------------------------------------------------------------------

/**
 * Intenta colocar un documento en su cliente, solo, y deja escrito por qué.
 *
 * Se llama SIEMPRE justo después de leer, venga de donde venga: de la entrada
 * por WhatsApp, del correo, del botón "Leer los que faltan" o de un reproceso.
 * Un solo sitio, o la asignación de la entrada nueva y la del reproceso acabarían
 * comportándose distinto sin que nadie se diera cuenta.
 *
 * NO pisa lo que ya tiene dueño: si el gestor ya lo colocó a mano, su palabra
 * vale más que la de la máquina.
 */
export async function asignarPorDatoDuro(
  tenantId: string,
  facturaId: string,
): Promise<FacturaRecibida | null> {
  const [{ resolverPorDatoDuro }, { listarClientes }] = await Promise.all([
    import("./gestoria-asignacion"),
    import("./gestoria-clientes"),
  ]);

  const todas = await listarFacturas(tenantId);
  const i = todas.findIndex((f) => f.id === facturaId);
  if (i < 0) return null;
  const f = todas[i];

  // Ya tiene dueño: no se toca. Solo se limpia un conflicto viejo que ya no aplica.
  if (f.cliente_id) {
    if (f.conflicto) {
      todas[i] = { ...f, conflicto: undefined };
      await guardarFacturas(tenantId, todas);
      return todas[i];
    }
    return f;
  }

  const clientes = await listarClientes(tenantId);
  const r = resolverPorDatoDuro(clientes, {
    nifDestinatario: f.lectura?.nifDestinatario?.valor ?? null,
    remitente: f.remitente ?? null,
  });

  if (r.tipo === "asignar") {
    todas[i] = {
      ...f,
      cliente_id: r.clienteId,
      estado: "pendiente",
      asignado_por: r.motivo === "manual" ? "manual" : r.motivo,
      asignado_motivo: r.detalle,
      conflicto: undefined,
    };
    await guardarFacturas(tenantId, todas);
    console.log(`[gestoria] ${facturaId} asignado solo a ${r.clienteNombre} (${r.motivo})`);
    return todas[i];
  }

  if (r.tipo === "conflicto") {
    todas[i] = {
      ...f,
      conflicto: { motivo: r.motivo === "manual" ? "nif" : r.motivo, valor: r.valor, clientes: r.clientes, detalle: r.detalle },
    };
    await guardarFacturas(tenantId, todas);
    console.warn(`[gestoria] ${facturaId} en conflicto: ${r.detalle}`);
    return todas[i];
  }

  // Sin dato duro que valga: se queda en Sin identificar, sin conflicto.
  if (f.conflicto) {
    todas[i] = { ...f, conflicto: undefined };
    await guardarFacturas(tenantId, todas);
    return todas[i];
  }
  return f;
}

/**
 * Mira si este documento ya estaba y, si lo está, lo marca.
 *
 * Se llama después de leer y de asignar, en ese orden, porque la comparación es
 * POR CLIENTE: hasta que no se sabe de quién es no se puede saber si repite algo
 * suyo. Nunca borra: marca y decide el gestor.
 */
export async function marcarSiEsDuplicado(
  tenantId: string,
  facturaId: string,
): Promise<FacturaRecibida | null> {
  const { buscarDuplicado } = await import("./gestoria-duplicados");
  const todas = await listarFacturas(tenantId);
  const i = todas.findIndex((f) => f.id === facturaId);
  if (i < 0) return null;
  const f = todas[i];

  // Si el gestor ya dijo que no lo es, no se le vuelve a discutir.
  if (f.duplicado_descartado) return f;

  const d = buscarDuplicado(f, todas);
  if (!d) {
    if (!f.duplicado_de) return f;
    todas[i] = { ...f, duplicado_de: undefined, duplicado_certeza: undefined, duplicado_detalle: undefined };
    await guardarFacturas(tenantId, todas);
    return todas[i];
  }

  todas[i] = { ...f, duplicado_de: d.originalId, duplicado_certeza: d.certeza, duplicado_detalle: d.detalle };
  await guardarFacturas(tenantId, todas);
  console.log(`[gestoria] ${facturaId} marcado duplicado (${d.certeza}) de ${d.originalId}`);
  return todas[i];
}

/** "No es duplicado": lo devuelve a normal y no se le vuelve a marcar. */
export async function noEsDuplicado(tenantId: string, facturaId: string): Promise<FacturaRecibida | null> {
  const todas = await listarFacturas(tenantId);
  const i = todas.findIndex((f) => f.id === facturaId);
  if (i < 0) return null;
  todas[i] = {
    ...todas[i],
    duplicado_de: undefined,
    duplicado_certeza: undefined,
    duplicado_detalle: undefined,
    duplicado_descartado: true,
  };
  await guardarFacturas(tenantId, todas);
  return todas[i];
}
