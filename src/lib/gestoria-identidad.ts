// Con qué datos se reconoce de quién es una factura que entra sola.
//
// POR QUÉ ESTO VIVE APARTE Y NO EN EL EXPEDIENTE
// ----------------------------------------------
// Un cliente tiene VARIOS expedientes (los trimestrales, la renta, las nóminas).
// Su NIF es uno solo. Si el NIF se guardara en el expediente habría que
// escribirlo tantas veces como trámites tenga y, en cuanto uno se corrigiera y
// otro no, habría dos verdades sobre el mismo cliente — y la que gana sería la
// que salga primero de la lista. Aquí hay UNA ficha de identificación por
// cliente, y la clave es la misma que en todo el módulo: su teléfono en dígitos.
//
// QUÉ NO ES ESTO
// --------------
// No es una agenda de contactos. Son los datos DUROS con los que se reconoce un
// documento: el NIF que viene impreso en el papel, los teléfonos desde los que
// manda cosas y los correos desde los que las manda. Nada más.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { kvGet, kvSet, supabaseEnabled } from "./supabase";

export type IdentidadCliente = {
  clienteId: string;
  /** Normalizado: sin puntos, sin guiones, en mayúsculas. Es con lo que se compara. */
  nif?: string;
  /** Tal y como lo escribió el gestor. Es lo que se le vuelve a enseñar. */
  nifMostrado?: string;
  /** Teléfonos desde los que este cliente manda facturas. Formato 34XXXXXXXXX. */
  telefonos: string[];
  /** Correos desde los que manda facturas. */
  emails: string[];
  actualizadoEn: string;
};

// -----------------------------------------------------------------------------
// Almacén — mismo patrón que el resto del módulo
// -----------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "gestoria-identidad.json");
const KV_KEY = (tenantId: string) => `gestoria:identidad:${tenantId}`;

export async function listarIdentidades(tenantId: string): Promise<IdentidadCliente[]> {
  if (supabaseEnabled()) return (await kvGet<IdentidadCliente[]>(KV_KEY(tenantId))) ?? [];
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
    const all = raw.trim() ? (JSON.parse(raw) as Record<string, IdentidadCliente[]>) : {};
    return all[tenantId] ?? [];
  } catch {
    return [];
  }
}

async function guardarTodas(tenantId: string, lista: IdentidadCliente[]): Promise<void> {
  if (supabaseEnabled()) return kvSet(KV_KEY(tenantId), lista);
  await fs.mkdir(DATA_DIR, { recursive: true });
  const raw = await fs.readFile(FILE, "utf-8").catch(() => "{}");
  const all = raw.trim() ? (JSON.parse(raw) as Record<string, IdentidadCliente[]>) : {};
  all[tenantId] = lista;
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

// -----------------------------------------------------------------------------
// NIF y DNI
// -----------------------------------------------------------------------------

/** B-12.345.678 → B12345678. Es lo único que se compara: nunca el texto crudo. */
export function normalizarNif(nif: string | null | undefined): string {
  return (nif || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE";

/** Teléfonos: se comparan en dígitos, para que dé igual +34, espacios o guiones. */
export const soloDigitos = (t: string | null | undefined): string => (t || "").replace(/\D/g, "");

/** Correos: en minúsculas y sin espacios. */
export const normalizarEmail = (e: string | null | undefined): string => (e || "").trim().toLowerCase();

export type ChequeoNif =
  | { valido: true; tipo: "dni" | "nie" | "cif" }
  | { valido: false; aviso: string };

/**
 * ¿Tiene forma de NIF o DNI español?
 *
 * Se AVISA, no se bloquea. Hay NIF raros —entidades extranjeras, casos viejos,
 * documentos con erratas que aun así son los buenos— y dejar al gestor peleándose
 * con un formulario que no le deja guardar es peor que un dato con una letra mal:
 * el dato mal se ve y se corrige, y el formulario que no deja guardar hace que no
 * se rellene nada.
 */
export function comprobarNif(entrada: string): ChequeoNif {
  const v = normalizarNif(entrada);
  if (!v) return { valido: false, aviso: "" };

  if (v.length !== 9) {
    return { valido: false, aviso: `"${entrada}" no tiene 9 caracteres. Un NIF o DNI español tiene 9. Puedes guardarlo igual.` };
  }

  // DNI: 8 números + letra de control.
  if (/^\d{8}[A-Z]$/.test(v)) {
    const esperada = LETRAS_DNI[Number(v.slice(0, 8)) % 23];
    if (v[8] !== esperada) {
      return { valido: false, aviso: `La letra del DNI no cuadra: para ${v.slice(0, 8)} debería ser "${esperada}", no "${v[8]}". Puedes guardarlo igual.` };
    }
    return { valido: true, tipo: "dni" };
  }

  // NIE: X/Y/Z + 7 números + letra. La inicial cuenta como 0/1/2.
  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) {
    const num = String("XYZ".indexOf(v[0])) + v.slice(1, 8);
    const esperada = LETRAS_DNI[Number(num) % 23];
    if (v[8] !== esperada) {
      return { valido: false, aviso: `La letra del NIE no cuadra: debería ser "${esperada}", no "${v[8]}". Puedes guardarlo igual.` };
    }
    return { valido: true, tipo: "nie" };
  }

  // CIF de sociedad: letra + 7 números + dígito o letra de control.
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(v)) {
    const cuerpo = v.slice(1, 8);
    let pares = 0;
    let impares = 0;
    for (let i = 0; i < 7; i++) {
      const d = Number(cuerpo[i]);
      // Las posiciones se cuentan desde 1: las impares se duplican.
      if (i % 2 === 0) {
        const doble = d * 2;
        impares += doble > 9 ? doble - 9 : doble;
      } else {
        pares += d;
      }
    }
    const control = (10 - ((pares + impares) % 10)) % 10;
    const letraControl = "JABCDEFGHI"[control];
    const ultimo = v[8];
    if (ultimo !== String(control) && ultimo !== letraControl) {
      return { valido: false, aviso: `El dígito de control del NIF no cuadra: debería ser "${control}" o "${letraControl}". Puedes guardarlo igual.` };
    }
    return { valido: true, tipo: "cif" };
  }

  return {
    valido: false,
    aviso: `"${entrada}" no tiene forma de NIF ni de DNI. Un autónomo lleva 8 números y letra; una sociedad empieza por letra. Puedes guardarlo igual.`,
  };
}

// -----------------------------------------------------------------------------
// Leer y guardar la ficha de un cliente
// -----------------------------------------------------------------------------

export async function identidadDe(tenantId: string, clienteId: string): Promise<IdentidadCliente | null> {
  const todas = await listarIdentidades(tenantId);
  return todas.find((i) => i.clienteId === clienteId) ?? null;
}

/** Con quién choca este NIF, si ya lo tiene otro. `null` si está libre. */
export async function nifEnUso(
  tenantId: string,
  nif: string,
  exceptoClienteId: string,
): Promise<string | null> {
  const v = normalizarNif(nif);
  if (!v) return null;
  const todas = await listarIdentidades(tenantId);
  const choque = todas.find((i) => i.clienteId !== exceptoClienteId && i.nif && i.nif === v);
  return choque ? choque.clienteId : null;
}

export type ResultadoGuardar =
  | { ok: true; identidad: IdentidadCliente; aviso?: string }
  | { ok: false; error: string };

/**
 * Guarda la ficha de identificación de un cliente.
 *
 * El NIF repetido SÍ para el guardado: dos clientes con el mismo NIF significa
 * que a partir de ese momento las facturas de uno se le sugieren al otro, y eso
 * es peor que no tener el dato. El formato raro solo avisa.
 */
export async function guardarIdentidad(opts: {
  tenantId: string;
  clienteId: string;
  nif?: string;
  telefonos?: string[];
  emails?: string[];
}): Promise<ResultadoGuardar> {
  const nifCrudo = (opts.nif || "").trim();
  const nif = normalizarNif(nifCrudo);

  if (nif) {
    const choque = await nifEnUso(opts.tenantId, nif, opts.clienteId);
    if (choque) {
      return {
        ok: false,
        error: `Ese NIF ya es de otro cliente de esta gestoría (teléfono ${choque}). Dos clientes con el mismo NIF harían que las facturas de uno se le propongan al otro. Corrige uno de los dos.`,
      };
    }
  }

  const limpiarLista = (xs: string[] | undefined, norm: (s: string) => string) =>
    [...new Set((xs || []).map(norm).filter(Boolean))];

  const identidad: IdentidadCliente = {
    clienteId: opts.clienteId,
    nif: nif || undefined,
    nifMostrado: nifCrudo || undefined,
    telefonos: limpiarLista(opts.telefonos, soloDigitos),
    emails: limpiarLista(opts.emails, normalizarEmail),
    actualizadoEn: new Date().toISOString(),
  };

  const todas = await listarIdentidades(opts.tenantId);
  const i = todas.findIndex((x) => x.clienteId === opts.clienteId);
  if (i >= 0) todas[i] = identidad;
  else todas.push(identidad);
  await guardarTodas(opts.tenantId, todas);

  const chequeo = nif ? comprobarNif(nifCrudo) : null;
  return {
    ok: true,
    identidad,
    aviso: chequeo && !chequeo.valido && chequeo.aviso ? chequeo.aviso : undefined,
  };
}
