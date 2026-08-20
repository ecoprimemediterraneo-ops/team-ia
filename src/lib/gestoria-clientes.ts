// Los clientes de una gestoría, sacados de sus expedientes.
//
// No se inventa una colección nueva de clientes: el sistema YA sabe quién es
// quién por los expedientes (teléfono + nombre), y duplicar esa lista sería
// crear dos verdades que se separan a la primera. El teléfono es la clave
// natural — es con lo que el cliente escribe por WhatsApp.

import "server-only";
import { listarExpedientes } from "./gestoria";
import { listarIdentidades, normalizarNif as normalizarNifCliente } from "./gestoria-identidad";

export type ClienteGestoria = {
  id: string;
  nombre: string;
  telefono: string;
  /**
   * Hoy los expedientes NO guardan email: este campo llega vacío siempre. Está
   * contemplado porque la regla de canal lo pide (móvil → WhatsApp con Pablo;
   * solo email → correo con Lucía; los dos → WhatsApp), y prefiero la regla
   * escrita y el dato pendiente a una regla a medias.
   */
  email?: string;
  /** NIF/CIF normalizado. Sirve para reconocer sus facturas. */
  nif?: string;
  /** El NIF tal y como lo escribió el gestor, para volvérselo a enseñar igual. */
  nifMostrado?: string;
  /** TODOS los teléfonos desde los que manda facturas, no solo el de la ficha. */
  telefonos: string[];
  /** Los correos desde los que manda facturas. */
  emails: string[];
};

export type CanalAviso = "whatsapp" | "email" | null;

/** Por dónde se le escribe a este cliente. Manda el dato, no la preferencia. */
export function canalDe(c: { telefono?: string; email?: string }): CanalAviso {
  if (c.telefono && c.telefono.trim()) return "whatsapp";
  if (c.email && c.email.trim()) return "email";
  return null;
}

/** Clave estable del cliente: su teléfono en dígitos. */
export const clienteIdDeTelefono = (t: string) => (t || "").replace(/\D/g, "");

export async function listarClientes(tenantId: string): Promise<ClienteGestoria[]> {
  const [expedientes, identidades] = await Promise.all([
    listarExpedientes(tenantId).catch(() => []),
    listarIdentidades(tenantId).catch(() => []),
  ]);
  const fichas = new Map(identidades.map((i) => [i.clienteId, i]));

  const porId = new Map<string, ClienteGestoria>();
  for (const e of expedientes) {
    const id = clienteIdDeTelefono(e.telefono);
    if (!id || porId.has(id)) continue;
    const f = fichas.get(id);
    porId.set(id, {
      id,
      nombre: e.clienteNombre || id,
      telefono: e.telefono,
      email: e.email,
      // La ficha de identificación MANDA sobre lo que ponga el expediente: es
      // donde el gestor lo escribe a propósito. El `nif` del expediente se sigue
      // leyendo como respaldo para no perder lo que ya hubiera puesto antes.
      nif: f?.nif || normalizarNifCliente(e.nif) || undefined,
      nifMostrado: f?.nifMostrado || e.nif || undefined,
      // El teléfono de la ficha del expediente siempre cuenta: es su número.
      telefonos: [...new Set([clienteIdDeTelefono(e.telefono), ...(f?.telefonos ?? [])].filter(Boolean))],
      emails: [...new Set([...(e.email ? [e.email.toLowerCase()] : []), ...(f?.emails ?? [])].filter(Boolean))],
    });
  }
  return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}


// -----------------------------------------------------------------------------
// De quién parece ser un documento que ha entrado sin dueño
// -----------------------------------------------------------------------------
//
// SOLO POR DATOS DUROS: el NIF impreso en el papel, o el teléfono desde el que
// llegó. NUNCA por el contenido ni por el proveedor. Un proveedor sale en las
// facturas de veinte clientes distintos, y "parece de Bar El Puerto porque pone
// cervezas" es exactamente el error que le mete a un cliente el gasto de otro.
//
// Y es una SUGERENCIA, no una asignación: el clic final lo da el gestor. La
// diferencia importa — asignar solo significa que un fallo silencioso acaba en
// el trimestre de quien no era.

// La regla de normalización vive en `gestoria-identidad`: una sola, o el NIF que
// se guarda y el que se compara acabarían siendo distintos.
export { normalizarNif } from "./gestoria-identidad";
// Alias local: dentro de este fichero se usa el mismo normalizador.
const normalizarNif = normalizarNifCliente;

export type Sugerencia = {
  clienteId: string;
  clienteNombre: string;
  /** Por qué se sugiere. Se enseña al gestor: una sugerencia sin motivo no se cree. */
  motivo: "nif" | "telefono" | "email";
  texto: string;
};

/**
 * ¿De quién parece este documento? `null` si no hay dato duro que lo diga.
 *
 * El NIF manda sobre el teléfono: el papel dice a nombre de quién está la
 * factura, mientras que el teléfono solo dice quién la mandó — y una gestoría
 * recibe facturas reenviadas por terceros.
 */
export function sugerirCliente(
  clientes: ClienteGestoria[],
  datos: { nifDestinatario?: string | null; remitente?: string | null },
): Sugerencia | null {
  const nif = normalizarNif(datos.nifDestinatario);
  if (nif.length >= 8) {
    const porNif = clientes.find((c) => c.nif && normalizarNif(c.nif) === nif);
    if (porNif) {
      return {
        clienteId: porNif.id,
        clienteNombre: porNif.nombre,
        motivo: "nif",
        texto: `Parece de: ${porNif.nombre} (el NIF del documento es el suyo)`,
      };
    }
  }

  // El remitente puede ser un teléfono o un correo, según entrara por Pablo o
  // por Lucía. Se prueban los dos contra TODOS los que tenga apuntados: el móvil
  // del dueño, el de la encargada, el del que hace las compras.
  const tel = clienteIdDeTelefono(datos.remitente || "");
  if (tel) {
    const porTel = clientes.find((c) => c.id === tel || c.telefonos?.includes(tel));
    if (porTel) {
      return {
        clienteId: porTel.id,
        clienteNombre: porTel.nombre,
        motivo: "telefono",
        texto: `Parece de: ${porTel.nombre} (lo mandó desde un teléfono suyo)`,
      };
    }
  }

  const email = (datos.remitente || "").trim().toLowerCase();
  if (email.includes("@")) {
    const porEmail = clientes.find((c) => c.emails?.includes(email));
    if (porEmail) {
      return {
        clienteId: porEmail.id,
        clienteNombre: porEmail.nombre,
        motivo: "email",
        texto: `Parece de: ${porEmail.nombre} (lo mandó desde un correo suyo)`,
      };
    }
  }

  return null;
}
