// Los clientes de una gestoría, sacados de sus expedientes.
//
// No se inventa una colección nueva de clientes: el sistema YA sabe quién es
// quién por los expedientes (teléfono + nombre), y duplicar esa lista sería
// crear dos verdades que se separan a la primera. El teléfono es la clave
// natural — es con lo que el cliente escribe por WhatsApp.

import "server-only";
import { listarExpedientes } from "./gestoria";

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
  const expedientes = await listarExpedientes(tenantId).catch(() => []);
  const porId = new Map<string, ClienteGestoria>();
  for (const e of expedientes) {
    const id = clienteIdDeTelefono(e.telefono);
    if (!id || porId.has(id)) continue;
    porId.set(id, { id, nombre: e.clienteNombre || id, telefono: e.telefono, email: e.email });
  }
  return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
