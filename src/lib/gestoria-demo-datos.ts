// =============================================================================
// LOS DATOS DE LA GESTORÍA DE DEMOSTRACIÓN, DENTRO DEL REPOSITORIO.
// =============================================================================
//
// POR QUÉ EXISTE ESTE FICHERO
// ---------------------------
// `data/` está en `.gitignore` y NO viaja al despliegue. Todo lo que se sembró
// en local —los 22 documentos, los 707 movimientos del extracto, los siete
// expedientes— vive solo en la máquina de quien lo sembró. En producción el
// módulo entero sale vacío: ni un cliente en el desplegable, ni un cargo que
// cuadrar, ni el aviso de "pagado sin factura".
//
// Eso bloquea el vídeo que Meta pide para el App Review, que hay que grabar
// contra aiteam.marketing y no contra localhost.
//
// Así que los datos se guardan como JSON versionado dentro de `src/`, que sí
// viaja, y se siembran por los MISMOS caminos que usa el producto
// (`guardarFacturas`, `guardarMovimientos`, `guardarExpedientes`…). No se
// inventa un almacén nuevo: si mañana cambia dónde se guarda una factura, esto
// cambia con ello.
//
// SOLO `tenant_demo_gestoria`. El tenant real (`tenant_aiteam`, con sus tres
// documentos de verdad) no se toca desde aquí: todas las escrituras van con el
// id de la demo puesto a mano, y la comprobación de abajo se asegura de que
// ningún registro semilla lleve otro tenant dentro.
//
// LO QUE ESTA SIEMBRA NO TRAE, Y NO ES UN OLVIDO: los ficheros binarios (los
// PDF y las fotos). Los registros apuntan a rutas del bucket privado que en
// producción están vacías, así que las tarjetas se ven enteras —proveedor,
// importe, fecha, clase— pero "VER" no abrirá el documento. Subir 22 binarios
// al repositorio para una demo sería peor que el problema que resuelve.

import "server-only";

import {
  listarFacturas,
  guardarFacturas,
  listarMovimientos,
  guardarMovimientos,
  type FacturaRecibida,
  type MovimientoBanco,
} from "./gestoria-facturas";
import { listarExpedientes, guardarExpedientes, type Expediente } from "./gestoria";
import { listarIdentidades, reemplazarIdentidades, type IdentidadCliente } from "./gestoria-identidad";
import { listarObligaciones, reemplazarObligaciones, type Obligacion } from "./gestoria-obligaciones";

import semillaFacturas from "@/data/demo-gestoria/facturas.json";
import semillaMovimientos from "@/data/demo-gestoria/movimientos.json";
import semillaExpedientes from "@/data/demo-gestoria/expedientes.json";
import semillaIdentidad from "@/data/demo-gestoria/identidad.json";
import semillaObligaciones from "@/data/demo-gestoria/obligaciones.json";

export const TENANT_DEMO = "tenant_demo_gestoria";

/**
 * Mete lo que falte y NO toca lo que ya está.
 *
 * Es lo que hace la siembra idempotente: se llama dos veces y la segunda no
 * añade nada. Se compara por `id` y no por contenido a propósito — si el gestor
 * ha tocado un documento después de sembrarlo (le ha puesto el cliente, lo ha
 * marcado conciliado), volver a lanzar la siembra NO puede deshacérselo.
 */
function unir<T extends { id: string }>(existentes: T[], semilla: T[]): { lista: T[]; nuevos: number } {
  const ids = new Set(existentes.map((x) => x.id));
  const faltan = semilla.filter((x) => !ids.has(x.id));
  return { lista: faltan.length ? [...existentes, ...faltan] : existentes, nuevos: faltan.length };
}

/** Igual, pero las identidades se identifican por cliente, no por `id`. */
function unirIdentidades(existentes: IdentidadCliente[], semilla: IdentidadCliente[]) {
  const vistos = new Set(existentes.map((x) => x.clienteId));
  const faltan = semilla.filter((x) => !vistos.has(x.clienteId));
  return { lista: faltan.length ? [...existentes, ...faltan] : existentes, nuevos: faltan.length };
}

export type ResultadoSiembra = {
  ok: boolean;
  /** Una línea por almacén: qué había, qué se ha metido, qué hay ahora. */
  detalle: string[];
  error?: string;
};

/**
 * Deja `tenant_demo_gestoria` como está en local. Idempotente.
 *
 * No crea el tenant ni sus clientes: de eso ya se encarga el preflight con
 * `sembrarDemos()` y `guardarExpedientes()`. Esto rellena lo de dentro.
 */
export async function sembrarDatosDemoGestoria(): Promise<ResultadoSiembra> {
  const detalle: string[] = [];
  try {
    // GUARDA DE SEGURIDAD. Ningún registro semilla puede llevar otro tenant
    // dentro: sembrar documentos ajenos en la cuenta real sería mucho peor que
    // no sembrar nada.
    const facturas = semillaFacturas as unknown as FacturaRecibida[];
    const movimientos = semillaMovimientos as unknown as MovimientoBanco[];
    const expedientes = semillaExpedientes as unknown as Expediente[];
    const identidades = semillaIdentidad as unknown as IdentidadCliente[];
    const obligaciones = semillaObligaciones as unknown as Obligacion[];

    const intruso =
      facturas.some((f) => f.tenant_id !== TENANT_DEMO) ||
      movimientos.some((m) => m.tenant_id !== TENANT_DEMO) ||
      expedientes.some((e) => e.tenantId !== TENANT_DEMO) ||
      obligaciones.some((o) => o.tenantId !== TENANT_DEMO);
    if (intruso) {
      return { ok: false, detalle, error: "Los datos semilla llevan un tenant que no es el de la demo. No se ha sembrado nada." };
    }

    // --- Expedientes (de aquí salen los clientes del desplegable) -----------
    {
      const previos = await listarExpedientes(TENANT_DEMO);
      const { lista, nuevos } = unir(previos, expedientes);
      if (nuevos) await guardarExpedientes(TENANT_DEMO, lista);
      detalle.push(`Expedientes: había ${previos.length}, metidos ${nuevos}, ahora ${lista.length}.`);
    }

    // --- Fichas de identidad (NIF, teléfonos, modelos) ----------------------
    {
      const previas = await listarIdentidades(TENANT_DEMO);
      const { lista, nuevos } = unirIdentidades(previas, identidades);
      if (nuevos) await reemplazarIdentidades(TENANT_DEMO, lista);
      detalle.push(`Fichas de identidad: había ${previas.length}, metidas ${nuevos}, ahora ${lista.length}.`);
    }

    // --- Los 22 documentos --------------------------------------------------
    {
      const previas = await listarFacturas(TENANT_DEMO);
      const { lista, nuevos } = unir(previas, facturas);
      if (nuevos) await guardarFacturas(TENANT_DEMO, lista);
      detalle.push(`Documentos: había ${previas.length}, metidos ${nuevos}, ahora ${lista.length}.`);
    }

    // --- El extracto del banco (los dos ficheros Norma 43 ya leídos) --------
    {
      const previos = await listarMovimientos(TENANT_DEMO);
      const { lista, nuevos } = unir(previos, movimientos);
      if (nuevos) await guardarMovimientos(TENANT_DEMO, lista);
      detalle.push(`Movimientos del banco: había ${previos.length}, metidos ${nuevos}, ahora ${lista.length}.`);
    }

    // --- Vencimientos (el aviso rojo de arriba) -----------------------------
    {
      const previas = await listarObligaciones(TENANT_DEMO);
      const { lista, nuevos } = unir(previas, obligaciones);
      if (nuevos) await reemplazarObligaciones(TENANT_DEMO, lista);
      detalle.push(`Vencimientos: había ${previas.length}, metidos ${nuevos}, ahora ${lista.length}.`);
    }

    return { ok: true, detalle };
  } catch (e) {
    return { ok: false, detalle, error: e instanceof Error ? e.message : String(e) };
  }
}


// -----------------------------------------------------------------------------
// TELÉFONOS: de los "600…" reales-posibles al prefijo 099 de mentira
// -----------------------------------------------------------------------------
// La siembra no pisa lo que ya existe, así que una demo sembrada con los
// teléfonos antiguos (600110011…, números que SÍ pueden existir) los conservaría
// para siempre. Esto los cambia en los cinco almacenes de la demo, y SOLO en la
// demo. `whatsapp-sender.ts` los bloquea de todos modos; esto además deja de
// enseñarlos en pantalla.

const CAMBIO_TELEFONOS: Array<[string, string]> = [
  ["600110011", "099000011"], ["600220022", "099000022"], ["600330033", "099000033"],
  ["600440044", "099000044"], ["600550055", "099000055"], ["600660066", "099000066"],
  ["34655443322", "34099000101"], ["34677555444", "34099000102"], ["34600111222", "34099000103"],
  ["34688111000", "34099000104"], ["34611999888", "34099000105"],
];

function cambiarTelefonos<T>(dato: T): { dato: T; cambios: number } {
  let txt = JSON.stringify(dato);
  let cambios = 0;
  for (const [viejo, nuevo] of CAMBIO_TELEFONOS) {
    const partes = txt.split(viejo);
    if (partes.length > 1) { cambios += partes.length - 1; txt = partes.join(nuevo); }
  }
  return { dato: JSON.parse(txt) as T, cambios };
}

export async function migrarTelefonosDemo(): Promise<{ ok: boolean; detalle: string[]; error?: string }> {
  const detalle: string[] = [];
  try {
    const exp = cambiarTelefonos(await listarExpedientes(TENANT_DEMO));
    if (exp.cambios) await guardarExpedientes(TENANT_DEMO, exp.dato);
    detalle.push(`Expedientes: ${exp.cambios} cambios.`);
    // Al cambiar el teléfono cambia el `clienteId` de la ficha. Si la semilla
    // nueva ya había metido la suya, quedarían dos por cliente: se juntan.
    const ide = cambiarTelefonos(await listarIdentidades(TENANT_DEMO));
    const porCliente = new Map<string, IdentidadCliente>();
    for (const f of ide.dato) {
      const previa = porCliente.get(f.clienteId);
      if (!previa) { porCliente.set(f.clienteId, f); continue; }
      const union = <T,>(a: T[] = [], b: T[] = []) => [...new Set([...a, ...b])];
      porCliente.set(f.clienteId, {
        ...previa, ...f,
        telefonos: union(previa.telefonos, f.telefonos),
        emails: union(previa.emails, f.emails),
        modelos: union(previa.modelos, f.modelos),
      });
    }
    const fichas = [...porCliente.values()];
    const juntadas = ide.dato.length - fichas.length;
    if (ide.cambios || juntadas) await reemplazarIdentidades(TENANT_DEMO, fichas);
    detalle.push(`Fichas de identidad: ${ide.cambios} cambios, ${juntadas} duplicadas juntadas.`);
    const fac = cambiarTelefonos(await listarFacturas(TENANT_DEMO));
    if (fac.cambios) await guardarFacturas(TENANT_DEMO, fac.dato);
    detalle.push(`Documentos: ${fac.cambios} cambios.`);
    const mov = cambiarTelefonos(await listarMovimientos(TENANT_DEMO));
    if (mov.cambios) await guardarMovimientos(TENANT_DEMO, mov.dato);
    detalle.push(`Movimientos del banco: ${mov.cambios} cambios.`);
    const obl = cambiarTelefonos(await listarObligaciones(TENANT_DEMO));
    if (obl.cambios) await reemplazarObligaciones(TENANT_DEMO, obl.dato);
    detalle.push(`Vencimientos: ${obl.cambios} cambios.`);
    return { ok: true, detalle };
  } catch (e) {
    return { ok: false, detalle, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Lo que hay ahora en la demo, sin escribir nada. */
export async function estadoDemoGestoria() {
  const [exp, ide, fac, mov, obl] = await Promise.all([
    listarExpedientes(TENANT_DEMO), listarIdentidades(TENANT_DEMO), listarFacturas(TENANT_DEMO),
    listarMovimientos(TENANT_DEMO), listarObligaciones(TENANT_DEMO),
  ]);
  const antiguos = CAMBIO_TELEFONOS.map(([v]) => v);
  const todo = JSON.stringify([exp, ide, fac, mov, obl]);
  return {
    expedientes: exp.length, fichasIdentidad: ide.length, documentos: fac.length,
    movimientosBanco: mov.length, vencimientos: obl.length,
    telefonosAntiguosPresentes: antiguos.filter((n) => todo.includes(n)),
    semilla: {
      expedientes: (semillaExpedientes as unknown[]).length, documentos: (semillaFacturas as unknown[]).length,
      movimientos: (semillaMovimientos as unknown[]).length, vencimientos: (semillaObligaciones as unknown[]).length,
    },
  };
}
